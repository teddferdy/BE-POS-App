require('dotenv').config({ path: __dirname + '/../.env' })

const guard = require('./destructive-guard')

// Phase 30F-1: default-deny guard runs BEFORE db/models is required,
// before authentication, and before sequelize.sync().
// Previously this file hardcoded NODE_ENV=production (removed).
const nodeEnv = process.env.NODE_ENV
const hasForceFlag = guard.parseForceFlag(process.argv)
const allowVar = process.env.ALLOW_DESTRUCTIVE_SYNC

let guardHost
let guardDatabase
try {
  const allConfigs = require('../config/config.js')
  const cfg = (nodeEnv && allConfigs[nodeEnv]) || allConfigs.development
  guardHost = cfg && cfg.host
  guardDatabase = cfg && cfg.database
} catch {
  guardHost = undefined
  guardDatabase = undefined
}

try {
  guard.assertDestructiveAllowed({
    operation: 'scripts/migrate.js force-sync',
    nodeEnv,
    host: guardHost,
    database: guardDatabase,
    allowVar,
    hasForceFlag
  })
} catch (err) {
  console.error(err.message)
  console.error(
    'Refusing to run destructive schema sync. ' +
      'Local dev workflow: NODE_ENV=development node scripts/migrate.js --force. ' +
      'Production force-sync is default-deny.'
  )
  process.exit(1)
}

const db = require('../db/models')

async function sync() {
  console.log(`🔄 Syncing database schema (NODE_ENV=${nodeEnv})...\n`)
  console.log(
    '⚠️  DESTRUCTIVE: this drops and recreates schema objects (force sync). Not a migration run.\n'
  )

  try {
    console.log('🔌 Connecting to database...')
    await db.sequelize.authenticate()
    console.log('✅ Connected!\n')

    console.log('📦 Dropping existing tables and recreating...')
    await db.sequelize.sync({ force: true })
    console.log('✅ Schema sync completed!\n')

    const [tables] = await db.sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    )
    console.log(`📋 Total tables: ${tables.length}`)
    console.log('Tables:', tables.map((t) => t.table_name).join(', '))
  } catch (error) {
    console.error('❌ Sync failed:', error.message)
    process.exit(1)
  } finally {
    await db.sequelize.close()
  }
}

sync()
