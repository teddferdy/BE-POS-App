require('dotenv').config({ path: __dirname + '/../.env' })
const db = require('../db/models')

const TABLES_TO_KEEP = ['role', 'type_payment', 'tax_config']

async function resetData() {
  console.log('🔄 Resetting all transactional data...\n')
  console.log(`🔒 Keeping tables: ${TABLES_TO_KEEP.join(', ')}`)
  console.log('🔒 Keeping: super_admin users\n')

  try {
    console.log('🔌 Connecting to database...')
    await db.sequelize.authenticate()
    console.log('✅ Connected!\n')

    const [results] = await db.sequelize.query(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )
    const allTables = results.map((r) => r.tablename)
    const tablesToTruncate = allTables.filter(
      (t) =>
        !TABLES_TO_KEEP.includes(t) && t !== 'user' && t !== 'SequelizeMeta'
    )

    await db.sequelize.transaction(async (t) => {
      console.log('🗑️  Truncating transactional tables...')
      for (const table of tablesToTruncate) {
        await db.sequelize.query(`TRUNCATE TABLE "${table}" CASCADE`, {
          transaction: t
        })
        console.log(`   ✅ ${table}`)
      }

      console.log('\n🗑️  Deleting non-super_admin users...')
      const deleted = await db.user.destroy({
        where: { roleType: { [db.Sequelize.Op.ne]: 'super_admin' } },
        force: true,
        transaction: t
      })
      console.log(`   ✅ Deleted ${deleted} users`)
    })

    console.log('\n✅ Data reset completed successfully!')
    console.log(`📋 Preserved tables: ${TABLES_TO_KEEP.join(', ')}`)
    console.log('👤 Preserved super_admin users in user table')
    console.log(`🗑️  Cleared ${tablesToTruncate.length} transactional tables`)
  } catch (error) {
    console.error('\n❌ Reset failed:', error.message)
    process.exit(1)
  } finally {
    await db.sequelize.close()
  }
}

resetData()
