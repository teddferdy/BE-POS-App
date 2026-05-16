require('dotenv').config({ path: __dirname + '/../.env' })
process.env.NODE_ENV = 'production'

const db = require('../db/models')

async function sync() {
  console.log('🔄 Syncing database schema to PRODUCTION...\n')

  try {
    console.log('🔌 Connecting to database...')
    await db.sequelize.authenticate()
    console.log('✅ Connected!\n')

    console.log('📦 Dropping existing tables and recreating...')
    await db.sequelize.sync({ force: true })
    console.log('✅ Schema sync completed!\n')

    const [tables] = await db.sequelize.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)
    console.log(`📋 Total tables: ${tables.length}`)
    console.log('Tables:', tables.map(t => t.table_name).join(', '))

  } catch (error) {
    console.error('❌ Sync failed:', error.message)
    process.exit(1)
  } finally {
    await db.sequelize.close()
  }
}

sync()