'use strict'

// Phase 22 Option B — targeted production schema remediation.
//
// Applies ONLY the DDL from these 3 existing migration files, by requiring
// each file and calling its real up(queryInterface, Sequelize) directly —
// not reimplemented DDL — so the applied schema is guaranteed identical to
// what the migration author wrote:
//   20260921000001-add-tax-fields-to-purchase-order.js
//   20260922000001-add-timezone-to-location.js
//   20260923000001-create-ap-reminder-event.js
//
// Deliberately does NOT touch SequelizeMeta and does NOT run sequelize-cli's
// sequential migrator — DB-2's migration history is independently divergent
// (see Phase 22 DB-2 reconciliation audits) and reconciling that is out of
// scope here. This script exists solely so these 3 specific, independently
// confirmed-safe, purely-additive schema gaps can be closed without
// depending on (or triggering) the broader unresolved migration chain.
//
// Idempotent: each step checks live schema first and skips if already
// present, so re-running this script after a partial failure is safe.

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
  logging: false
})

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column`,
    { replacements: { table, column } }
  )
  return rows.length > 0
}

async function tableExists(table) {
  const [rows] = await sequelize.query(`SELECT to_regclass(:qualified) AS exists`, {
    replacements: { qualified: `public.${table}` }
  })
  return !!rows[0].exists
}

async function indexExists(table, indexName) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM pg_indexes WHERE tablename = :table AND indexname = :indexName`,
    { replacements: { table, indexName } }
  )
  return rows.length > 0
}

// Migration files call queryInterface methods with no explicit transaction
// (the 4th/3rd "options" arg is never passed), so there is no single
// Sequelize transaction spanning a whole migration's up() to wrap here.
// Each individual DDL statement (addColumn, createTable, addIndex) is
// already atomic at the Postgres level on its own. For the one migration
// with more than one DDL statement (ap_reminder_event: createTable +
// addIndex), the idempotency check below verifies BOTH the table AND the
// index, so a re-run after any partial failure correctly detects and
// completes only what's still missing rather than erroring on
// already-existing objects.
async function runStep(label, alreadyDoneCheck, migrationFile) {
  console.log(`\n--- ${label} ---`)
  if (await alreadyDoneCheck()) {
    console.log('SKIP: already present, no action taken')
    return 'skipped'
  }
  const migration = require(path.resolve(__dirname, '..', 'db/migrations', migrationFile))
  try {
    await migration.up(sequelize.getQueryInterface(), Sequelize)
    console.log('APPLIED')
    return 'applied'
  } catch (err) {
    console.error('FAILED:', err.message)
    throw err
  }
}

async function main() {
  await sequelize.authenticate()
  console.log('Connected. Applying Phase 22 Option B remediation (additive only, SequelizeMeta untouched).')

  const results = {}

  results.locationTimezone = await runStep(
    'location.timezone',
    () => columnExists('location', 'timezone'),
    '20260922000001-add-timezone-to-location.js'
  )

  results.purchaseOrderTax = await runStep(
    'purchase_order.taxRate + taxAmount',
    async () => (await columnExists('purchase_order', 'taxRate')) && (await columnExists('purchase_order', 'taxAmount')),
    '20260921000001-add-tax-fields-to-purchase-order.js'
  )

  results.apReminderEvent = await runStep(
    'ap_reminder_event',
    async () =>
      (await tableExists('ap_reminder_event')) &&
      (await indexExists('ap_reminder_event', 'ap_reminder_event_idempotency_key')),
    '20260923000001-create-ap-reminder-event.js'
  )

  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(results, null, 2))

  await sequelize.close()
}

main().catch((e) => {
  console.error('\nREMEDIATION ABORTED:', e.message)
  process.exit(1)
})
