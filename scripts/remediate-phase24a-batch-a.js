'use strict'

// Phase 24 Batch A — ZERO-RISK ADDITIVE + MONETARY TYPE-WIDENING REMEDIATION
//
// Applies ONLY the 12 schema changes from:
//   20260917000001-add-redeemed-points-to-order.js  (order.redeemedPoints)
//   20260920000001-migrate-monetary-columns-to-bigint.js (11 BIGINT columns)
//
// Deliberately does NOT touch SequelizeMeta and does NOT run the sequential
// migrator — same disjoint-history discipline as Phase 22 Option B.
// See scripts/remediate-phase22-blockers.js for precedent.
//
// Idempotent: each step checks live schema first and skips if already correct,
// stops and reports if schema is unexpectedly incompatible.

process.env.NODE_ENV = 'production'
const path = require('path')
const cfg = require(path.resolve(__dirname, '..', 'config/config.js')).production
const { Sequelize } = require('sequelize')

const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
  host: cfg.host,
  port: cfg.port,
  dialect: cfg.dialect,
  dialectModule: cfg.dialectModule,
  dialectOptions: cfg.dialectOptions,
  logging: false,
})

const BIGINT_COLUMNS = [
  { table: 'order', column: 'subTotal' },
  { table: 'order', column: 'discountAmount' },
  { table: 'order', column: 'taxAmount' },
  { table: 'order', column: 'serviceChargeAmount' },
  { table: 'order', column: 'totalPrice' },
  { table: 'transaction', column: 'amount' },
  { table: 'transaction', column: 'cashReceived' },
  { table: 'transaction', column: 'changeGiven' },
  { table: 'order_item', column: 'price' },
  { table: 'order_item', column: 'discountAmount' },
  { table: 'order_item', column: 'totalPrice' },
]

async function columnInfo(table, column) {
  const [rows] = await sequelize.query(
    `SELECT data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = :table AND column_name = :column`,
    { replacements: { table, column } },
  )
  return rows[0] || null
}

async function getCounts() {
  const counts = {}
  for (const tbl of ['order', 'transaction', 'order_item']) {
    const [r] = await sequelize.query(`SELECT count(*)::int AS cnt FROM "${tbl}"`)
    counts[tbl] = r[0].cnt
  }
  return counts
}

async function getMaxValues() {
  const maxes = {}
  for (const { table, column } of BIGINT_COLUMNS) {
    const [r] = await sequelize.query(`SELECT MAX("${column}") AS max FROM "${table}"`)
    maxes[`${table}.${column}`] = r[0].max
  }
  return maxes
}

async function main() {
  await sequelize.authenticate()
  console.log('Connected to production for Phase 24A remediation (additive + type-widening only, SequelizeMeta untouched).')

  // ------------------------------------------------------------
  // PRE-FLIGHT — DATABASE IDENTITY (no credentials)
  // ------------------------------------------------------------
  const [identity] = await sequelize.query(`SELECT version(), current_database() AS db, current_user AS usr`)
  const id = identity[0]
  console.log('\n=== PRE-FLIGHT: DATABASE IDENTITY ===')
  // version string contains PG version; truncate to first line for brevity
  console.log(`PostgreSQL: ${id.version.split(',')[0]}`)
  console.log(`Database:   ${id.db}`)
  console.log(`User:       ${id.usr}`)
  // Verify DB is expected production (neondb)
  if (id.db !== cfg.database) {
    console.warn(`WARNING: connected database "${id.db}" != configured "${cfg.database}"`)
  }

  const [metaCountRows] = await sequelize.query(`SELECT count(*)::int AS cnt FROM "SequelizeMeta"`)
  const metaCount = metaCountRows[0].cnt
  console.log(`SequelizeMeta count: ${metaCount} (expected 22)`)

  // ------------------------------------------------------------
  // PRE-FLIGHT — SCHEMA CHECKS
  // ------------------------------------------------------------
  console.log('\n=== PRE-FLIGHT: SCHEMA STATE ===')

  // redeemedPoints
  const rpInfo = await columnInfo('order', 'redeemedPoints')
  if (!rpInfo) {
    console.log('order.redeemedPoints: ABSENT (will be added)')
  } else {
    console.log(`order.redeemedPoints: present — data_type=${rpInfo.data_type} udt=${rpInfo.udt_name} nullable=${rpInfo.is_nullable} default=${rpInfo.column_default}`)
    // Validate expected shape if present
    if (rpInfo.data_type !== 'integer' || rpInfo.udt_name !== 'int4') {
      console.error('BLOCKED — REMEDIATION NOT SAFE TO COMPLETE')
      console.error(`order.redeemedPoints exists but with incompatible type: ${rpInfo.data_type}/${rpInfo.udt_name} (expected integer/int4). Manual review required.`)
      await sequelize.close()
      process.exit(2)
    }
    // nullable should be YES, default should contain 0
    if (rpInfo.is_nullable !== 'YES') {
      console.error('BLOCKED — REMEDIATION NOT SAFE TO COMPLETE')
      console.error(`order.redeemedPoints is_nullable=${rpInfo.is_nullable}, expected YES.`)
      await sequelize.close()
      process.exit(2)
    }
  }

  // BIGINT columns
  let needsAlter = []
  let alreadyBigint = []
  let unexpectedTypes = []
  for (const { table, column } of BIGINT_COLUMNS) {
    const info = await columnInfo(table, column)
    if (!info) {
      console.error(`BLOCKED — REMEDIATION NOT SAFE TO COMPLETE`)
      console.error(`Missing column ${table}.${column} — cannot ALTER TYPE on non-existent column.`)
      await sequelize.close()
      process.exit(2)
    }
    if (info.data_type === 'bigint' && info.udt_name === 'int8') {
      alreadyBigint.push(`${table}.${column}`)
      console.log(`${table}.${column}: bigint/int8 — already correct (will SKIP)`)
    } else if (info.data_type === 'integer' && info.udt_name === 'int4') {
      needsAlter.push(`${table}.${column}`)
      console.log(`${table}.${column}: integer/int4 — will ALTER to BIGINT`)
    } else {
      unexpectedTypes.push(`${table}.${column}: ${info.data_type}/${info.udt_name}`)
      console.log(`${table}.${column}: ${info.data_type}/${info.udt_name} — UNEXPECTED`)
    }
  }
  if (unexpectedTypes.length > 0) {
    console.error('BLOCKED — REMEDIATION NOT SAFE TO COMPLETE')
    console.error(`Unexpected column types detected: ${unexpectedTypes.join(', ')}`)
    await sequelize.close()
    process.exit(2)
  }

  // Row counts
  const countsBefore = await getCounts()
  console.log('\n=== PRE-FLIGHT: ROW COUNTS ===')
  for (const [tbl, cnt] of Object.entries(countsBefore)) {
    console.log(`${tbl}: ${cnt}`)
  }

  // Max values safety check
  const maxesBefore = await getMaxValues()
  console.log('\n=== PRE-FLIGHT: MAX VALUES (11 monetary columns) ===')
  let abortMax = false
  for (const [key, val] of Object.entries(maxesBefore)) {
    const n = val === null ? null : Number(val)
    console.log(`${key}: ${val} (numeric ${n})`)
    // BIGINT range is -9e18 to 9e18, INTEGER range is -2e9 to 2e9.
    // Widening int4→int8 is always safe for existing int4 values.
    // Abort only if value is outside int8 safe range or cannot be cast (NaN).
    if (val !== null && (Number.isNaN(n) || n > Number.MAX_SAFE_INTEGER || n < Number.MIN_SAFE_INTEGER)) {
      // For monetary we use actual int8 limits, not JS safe integer, but log warning
      if (n > 9223372036854775807 || n < -9223372036854775808) {
        console.error(`Value ${val} for ${key} outside BIGINT range — aborting`)
        abortMax = true
      }
    }
  }
  if (abortMax) {
    console.error('BLOCKED — REMEDIATION NOT SAFE TO COMPLETE: max value outside BIGINT range')
    await sequelize.close()
    process.exit(2)
  }

  // ------------------------------------------------------------
  // EXECUTION PLAN
  // ------------------------------------------------------------
  console.log('\n=== PHASE 24A PRODUCTION REMEDIATION — EXECUTION PLAN ===')
  console.log('Target changes (12 intended):')
  const plan = []
  if (!rpInfo) {
    plan.push('  - ADD order.redeemedPoints INTEGER DEFAULT 0 (nullable YES)')
  } else {
    plan.push('  - SKIP order.redeemedPoints (already correct)')
  }
  for (const key of needsAlter) {
    plan.push(`  - ALTER ${key} -> BIGINT`)
  }
  for (const key of alreadyBigint) {
    plan.push(`  - SKIP ${key} (already BIGINT)`)
  }
  console.log(plan.join('\n'))
  console.log(`\nRows before: order=${countsBefore.order} transaction=${countsBefore.transaction} order_item=${countsBefore.order_item}`)
  console.log(`SequelizeMeta before: ${metaCount}`)
  const totalOps = (rpInfo ? 0 : 1) + needsAlter.length
  console.log(`Total DDL operations to execute: ${totalOps}`)
  if (totalOps === 0) {
    console.log('No schema changes required — all 12 targets already correct. Proceeding to verification.')
  }

  // ------------------------------------------------------------
  // MUTATION — APPLY ONLY THE 12 INTENDED CHANGES
  // ------------------------------------------------------------
  const results = {}

  // 1. redeemedPoints
  console.log('\n--- order.redeemedPoints ---')
  if (!rpInfo) {
    console.log('Adding column order.redeemedPoints INTEGER DEFAULT 0 (allowNull true)...')
    // Use raw DDL equivalent to migration's addColumn: preserve nullable behavior, default 0
    await sequelize.query(`ALTER TABLE "order" ADD COLUMN "redeemedPoints" INTEGER DEFAULT 0`)
    console.log('APPLIED: order.redeemedPoints added')
    results.redeemedPoints = 'applied'
  } else {
    console.log('SKIP: already present, no action taken')
    results.redeemedPoints = 'skipped'
  }

  // 2. BIGINT widening
  for (const { table, column } of BIGINT_COLUMNS) {
    const label = `${table}.${column}`
    const infoBefore = await columnInfo(table, column)
    // Re-check (idempotent): if already bigint, skip
    if (infoBefore && infoBefore.data_type === 'bigint') {
      console.log(`--- ${label} --- SKIP: already BIGINT`)
      results[label] = 'skipped'
      continue
    }
    console.log(`--- ${label} --- ALTER TYPE BIGINT USING "${column}"::bigint`)
    await sequelize.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE BIGINT USING "${column}"::bigint`)
    console.log(`APPLIED: ${label} -> BIGINT`)
    results[label] = 'applied'
  }

  console.log('\n=== SUMMARY OF APPLIED CHANGES ===')
  console.log(JSON.stringify(results, null, 2))

  // ------------------------------------------------------------
  // POST-MUTATION VERIFICATION — SCHEMA
  // ------------------------------------------------------------
  console.log('\n=== POST-MUTATION VERIFICATION: SCHEMA ===')
  let schemaOk = true

  const rpAfter = await columnInfo('order', 'redeemedPoints')
  if (!rpAfter) {
    console.error('FAIL: order.redeemedPoints still missing after mutation')
    schemaOk = false
  } else {
    console.log(`order.redeemedPoints: data_type=${rpAfter.data_type} udt=${rpAfter.udt_name} nullable=${rpAfter.is_nullable} default=${rpAfter.column_default}`)
    if (rpAfter.data_type !== 'integer' || rpAfter.udt_name !== 'int4') {
      console.error('FAIL: order.redeemedPoints type mismatch after mutation')
      schemaOk = false
    }
    if (rpAfter.is_nullable !== 'YES') {
      console.error('FAIL: order.redeemedPoints should be nullable YES')
      schemaOk = false
    }
    if (!String(rpAfter.column_default).includes('0')) {
      console.error('FAIL: order.redeemedPoints default should contain 0')
      schemaOk = false
    }
  }

  for (const { table, column } of BIGINT_COLUMNS) {
    const info = await columnInfo(table, column)
    if (!info || info.data_type !== 'bigint' || info.udt_name !== 'int8') {
      console.error(`FAIL: ${table}.${column} expected bigint/int8, got ${info ? `${info.data_type}/${info.udt_name}` : 'MISSING'}`)
      schemaOk = false
    } else {
      console.log(`${table}.${column}: bigint/int8 — OK`)
    }
  }

  // ------------------------------------------------------------
  // POST-MUTATION VERIFICATION — ROW COUNTS & MAX VALUES
  // ------------------------------------------------------------
  console.log('\n=== POST-MUTATION VERIFICATION: DATA INTEGRITY ===')
  const countsAfter = await getCounts()
  for (const tbl of ['order', 'transaction', 'order_item']) {
    const before = countsBefore[tbl]
    const after = countsAfter[tbl]
    const ok = before === after
    console.log(`${tbl}: before=${before} after=${after} ${ok ? 'OK' : 'FAIL'}`)
    if (!ok) schemaOk = false
  }

  const maxesAfter = await getMaxValues()
  for (const { table, column } of BIGINT_COLUMNS) {
    const key = `${table}.${column}`
    const before = maxesBefore[key]
    const after = maxesAfter[key]
    // Use string comparison for bigint values; Number() may be lossy for huge, but here values are small
    const b = before === null ? null : String(before)
    const a = after === null ? null : String(after)
    const ok = b === a
    console.log(`${key}: max before=${b} after=${a} ${ok ? 'OK' : 'FAIL'}`)
    if (!ok) schemaOk = false
  }

  // SequelizeMeta unchanged
  const [metaAfterRows] = await sequelize.query(`SELECT count(*)::int AS cnt FROM "SequelizeMeta"`)
  const metaAfter = metaAfterRows[0].cnt
  console.log(`\nSequelizeMeta: before=${metaCount} after=${metaAfter} ${metaAfter === metaCount ? 'OK (unchanged)' : 'FAIL'}`)
  if (metaAfter !== metaCount) schemaOk = false
  if (metaAfter !== 22) {
    console.warn(`WARNING: SequelizeMeta is ${metaAfter}, expected 22 per Phase 24 spec (but untouched is what matters)`)
  }

  if (!schemaOk) {
    console.error('\nPOST-MUTATION VERIFICATION FAILED — remediation may be incomplete')
    await sequelize.close()
    process.exit(3)
  }

  console.log('\nPOST-MUTATION VERIFICATION PASSED')

  await sequelize.close()
  console.log('\nPHASE 24A REMEDIATION COMPLETE — all 12 targets verified, no business data mutated, SequelizeMeta untouched.')
}

main().catch((e) => {
  console.error('\nREMEDIATION ABORTED:', e.message)
  console.error(e.stack)
  process.exit(1)
})
