'use strict'

// TASK 7 — guarded TEST-ONLY legacy user migration harness.
//
// Converts legacy users into tenant memberships + store assignments on the
// isolated `cashier_app_test` database ONLY, driven by the read-only
// planners (planLegacyUserConversion / classifyLegacySuperAdmin). Refuses
// production configuration, is idempotent, emits evidence, fails closed on
// unresolved authorization, and NEVER silently converts super_admin.
//
// Never uses JWT claims as migration authority.

const { planLegacyUserConversion } = require('./plan-legacy-user-migration')
const { classifyLegacySuperAdmin } = require('./plan-super-admin-classification')

const TEST_DATABASE = process.env.DB_TEST_DATABASE || 'cashier_app_test'

const assertTestDatabase = (db) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[user-migration] REFUSED: will not run with NODE_ENV=production')
  }
  // Production-adjacent URL vars refuse ONLY when they point off-box (same
  // rationale as the tenant harness: localhost .env URLs are dev-local).
  for (const v of ['POSTGRES_URL', 'DATABASE_URL', 'NEON_DATABASE_URL']) {
    const raw = process.env[v]
    if (!raw) continue
    let host = ''
    try {
      host = new URL(raw).hostname
    } catch {
      throw new Error(`[user-migration] REFUSED: ${v} is set and unparseable`)
    }
    if (host && !['localhost', '127.0.0.1', '::1'].includes(host)) {
      throw new Error(`[user-migration] REFUSED: ${v} points at ${host} (production-adjacent)`)
    }
  }
  const name =
    (db?.sequelize?.getDatabaseName && db.sequelize.getDatabaseName()) ||
    process.env.DB_DEV_DATABASE ||
    ''
  if (name && name !== TEST_DATABASE) {
    throw new Error(`[user-migration] REFUSED: connected database is ${name}, expected ${TEST_DATABASE}`)
  }
}

const isDeleted = (row) => row != null && row.deletedAt != null && row.deletedAt !== ''

async function applyLegacyUserMigration({ db, users, failOnUnresolved = false } = {}) {
  if (!db) throw new Error('[user-migration] db is required')
  assertTestDatabase(db)
  const list = Array.isArray(users) ? users : []
  const evidence = {
    migrated: 0, skipped: 0, unresolved: 0, superAdminReview: 0, errors: [], changes: []
  }

  // Resolve store/tenant snapshots once for the planner (read-only).
  const storeIds = [...new Set(list.map((u) => Number(u?.store)).filter((n) => Number.isInteger(n) && n > 0))]
  const stores = storeIds.length > 0
    ? await db.location.findAll({ where: { id: storeIds }, attributes: ['id', 'tenantId', 'deletedAt'], paranoid: false })
    : []
  const storesById = {}
  for (const s of stores) storesById[s.id] = { id: s.id, tenantId: s.tenantId, deletedAt: s.deletedAt }

  for (const user of list) {
    // SUPER-01 gate first: super_admin is NEVER auto-converted.
    if (user?.roleType === 'super_admin') {
      const classification = classifyLegacySuperAdmin({
        id: user.id, roleType: user.roleType, store: user.store, status: user.status, deletedAt: user.deletedAt
      })
      evidence.superAdminReview += 1
      evidence.errors.push({ userId: user.id ?? null, code: 'SUPER_ADMIN_REVIEW', classification: classification.classification })
      if (failOnUnresolved) {
        const err = new Error('[user-migration] unresolved: store-bound/global super_admin requires review')
        err.evidence = evidence
        throw err
      }
      continue
    }

    const plan = planLegacyUserConversion(
      { id: user.id, roleType: user.roleType, roleId: user.roleId, store: user.store, status: user.status, deletedAt: user.deletedAt },
      { storesById }
    )
    if (plan.status !== 'ready') {
      evidence.unresolved += 1
      evidence.errors.push({ userId: user.id ?? null, code: plan.conflicts[0]?.code || 'UNRESOLVED', conflicts: plan.conflicts })
      if (failOnUnresolved) {
        const err = new Error(`[user-migration] unresolved user ${user.id}: ${plan.conflicts[0]?.code || 'UNRESOLVED'}`)
        err.evidence = evidence
        throw err
      }
      continue
    }

    // Idempotency: existing membership/assignment means already applied.
    const existing = await db.tenantMembership.findOne({
      where: { userId: user.id, tenantId: plan.candidateTenantId }
    })
    if (existing) {
      evidence.skipped += 1
      continue
    }
    if (isDeleted(user)) {
      evidence.unresolved += 1
      continue
    }
    await db.tenantMembership.findOrCreate({
      where: { userId: user.id, tenantId: plan.candidateTenantId },
      defaults: { userId: user.id, tenantId: plan.candidateTenantId, role: plan.candidateRole, status: 'ACTIVE' }
    })
    for (const storeId of plan.candidateStoreIds) {
      await db.storeAssignment.findOrCreate({
        where: { userId: user.id, storeId },
        defaults: { userId: user.id, tenantId: plan.candidateTenantId, storeId }
      })
    }
    evidence.migrated += 1
    evidence.changes.push({ userId: user.id, tenantId: plan.candidateTenantId, role: plan.candidateRole })
  }
  return evidence
}

module.exports = { applyLegacyUserMigration }
