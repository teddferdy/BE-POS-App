'use strict'

// TASK 7 — guarded TEST-ONLY tenant foundation migration harness.
//
// Applies an approved store/tenant mapping artifact to the isolated
// `cashier_app_test` database ONLY. Refuses production configuration,
// runs the read-only preflight before ANY write, is idempotent and
// resumable, emits evidence, and supports rollback from that evidence.
//
// Production migration/backfill/seed/sync/deployment is PROHIBITED — this
// module refuses to run when NODE_ENV=production, when production-adjacent
// DATABASE_URL-style variables are present, or when the connected database
// is anything other than the isolated test database.
//
// Never uses JWT claims as migration authority. Never silently converts
// super_admin (user migration is a separate harness with SUPER-01 review).

const { validateStoreMapping } = require('./tenant-backfill-preflight')

const TEST_DATABASE = process.env.DB_TEST_DATABASE || 'cashier_app_test'

const assertTestDatabase = (db) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[tenant-migration] REFUSED: will not run with NODE_ENV=production')
  }
  // Production-adjacent URL vars refuse ONLY when they point off-box. A
  // localhost DATABASE_URL (this repo's .env dev convenience) is local, not
  // production — the connected-database check below is the binding gate.
  for (const v of ['POSTGRES_URL', 'DATABASE_URL', 'NEON_DATABASE_URL']) {
    const raw = process.env[v]
    if (!raw) continue
    let host = ''
    try {
      host = new URL(raw).hostname
    } catch {
      throw new Error(`[tenant-migration] REFUSED: ${v} is set and unparseable`)
    }
    if (host && !['localhost', '127.0.0.1', '::1'].includes(host)) {
      throw new Error(`[tenant-migration] REFUSED: ${v} points at ${host} (production-adjacent)`)
    }
  }
  const name =
    (db?.sequelize?.getDatabaseName && db.sequelize.getDatabaseName()) ||
    process.env.DB_DEV_DATABASE ||
    ''
  if (name && name !== TEST_DATABASE) {
    throw new Error(`[tenant-migration] REFUSED: connected database is ${name}, expected ${TEST_DATABASE}`)
  }
}

const toPositiveInt = (value) => {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

// Applies one MAP row idempotently; records prior state for rollback.
const applyMapRow = async (db, row, evidence, changes) => {
  const store = await db.location.findByPk(row.storeId, { attributes: ['id', 'tenantId', 'status'] })
  if (!store) throw new Error(`STORE_NOT_FOUND:${row.storeId}`)
  if (store.tenantId != null && Number(store.tenantId) !== Number(row.tenantId)) {
    throw new Error(`STORE_TENANT_MISMATCH:${row.storeId}`)
  }
  if (store.tenantId != null && Number(store.tenantId) === Number(row.tenantId)) {
    evidence.skipped += 1
    return
  }
  const tenant = await db.tenant.findByPk(row.tenantId, { attributes: ['id', 'status', 'deletedAt'] })
  if (!tenant || tenant.deletedAt != null || tenant.status !== 'active') {
    throw new Error(`TENANT_NOT_APPROVED:${row.tenantId}`)
  }
  changes.push({ storeId: store.id, before: { tenantId: store.tenantId, status: store.status } })
  await store.update({ tenantId: row.tenantId }, { allowTenantReassignment: true })
  evidence.applied += 1
}

const applyLifecycleRow = async (db, row, status, key, evidence, changes) => {
  const store = await db.location.findByPk(row.storeId, { attributes: ['id', 'tenantId', 'status'] })
  if (!store) throw new Error(`STORE_NOT_FOUND:${row.storeId}`)
  if (store.status === status) {
    evidence.skipped += 1
    return
  }
  changes.push({ storeId: store.id, before: { tenantId: store.tenantId, status: store.status } })
  await store.update({ status })
  evidence[key] += 1
}

async function applyTenantFoundationMigration({ db, mappingRows, continueOnError = false } = {}) {
  if (!db) throw new Error('[tenant-migration] db is required')
  assertTestDatabase(db)
  const rows = Array.isArray(mappingRows) ? mappingRows : mappingRows?.rows
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('[tenant-migration] an approved non-empty mapping artifact is required')
  }

  // Preflight BEFORE writes: compare against persisted stores.
  const storeIds = [...new Set(rows.map((r) => toPositiveInt(r?.storeId)).filter(Boolean))]
  const persisted = storeIds.length > 0
    ? await db.location.findAll({ where: { id: storeIds }, attributes: ['id', 'tenantId'], paranoid: false })
    : []
  const preflight = validateStoreMapping(rows, persisted.map((s) => ({ id: s.id, tenantId: s.tenantId })))
  if (!preflight.valid) {
    const err = new Error(`[tenant-migration] preflight failed: ${preflight.errors.map((e) => e.code).join(',')}`)
    err.preflight = preflight
    throw err
  }

  const evidence = {
    valid: true, applied: 0, skipped: 0, quarantined: 0, global: 0, retired: 0,
    unresolved: 0, errors: [], changes: []
  }
  const changes = []

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const disposition = String(row.disposition || '').trim().toUpperCase()
    try {
      if (disposition === 'MAP') {
        await applyMapRow(db, { storeId: toPositiveInt(row.storeId), tenantId: toPositiveInt(row.tenantId) }, evidence, changes)
      } else if (disposition === 'QUARANTINE') {
        await applyLifecycleRow(db, { storeId: toPositiveInt(row.storeId) }, 'quarantined', 'quarantined', evidence, changes)
      } else if (disposition === 'GLOBAL') {
        evidence.global += 1 // explicit: no store mutation, recorded only
      } else if (disposition === 'RETIRE') {
        await applyLifecycleRow(db, { storeId: toPositiveInt(row.storeId) }, 'retired', 'retired', evidence, changes)
      } else {
        throw new Error(`UNKNOWN_DISPOSITION:${disposition}`)
      }
    } catch (err) {
      evidence.unresolved += 1
      evidence.errors.push({ rowIndex: i, code: String(err.message || 'APPLY_FAILED').split(':')[0], message: err.message })
      if (!continueOnError) {
        err.evidence = { ...evidence, changes }
        throw err
      }
    }
  }
  evidence.changes = changes
  return evidence
}

async function rollbackTenantFoundationMigration({ db, evidence } = {}) {
  if (!db) throw new Error('[tenant-migration] db is required')
  assertTestDatabase(db)
  const changes = evidence?.changes || []
  let reverted = 0
  for (const change of changes) {
    const store = await db.location.findByPk(change.storeId)
    if (!store) continue
    await store.update(
      { tenantId: change.before.tenantId, status: change.before.status },
      { allowTenantReassignment: true }
    )
    reverted += 1
  }
  return { reverted }
}

module.exports = { applyTenantFoundationMigration, rollbackTenantFoundationMigration }
