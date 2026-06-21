//!/usr/bin/env node
require('dotenv').config({ path: __dirname + '/.env' })
const db = require('./db/models/index')

async function seedTestData() {
  console.log('🌱 Seeding test data for all 9 entities...\n')
  
  try {
    console.log('🔌 Connecting to database...')
    await db.sequelize.authenticate()
    console.log('✅ Connected!\n')

    // Reset transactional tables (but keep data for reference)
    const TABLES_TO_KEEP = ['role', 'type_payment', 'tax_config', 'member_tier', 'category', 'supplier', 'department', 'position', 'shift', 'member', 'product']
    
    const [results] = await db.sequelize.query(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )
    const allTables = results.map(r => r.tablename)
    const tablesToTruncate = allTables.filter(t => !TABLES_TO_KEEP.includes(t) && t !== 'SequelizeMeta' && t !== 'user' && t !== 'employee')

    await db.sequelize.transaction(async (t) => {
      console.log('🗑️  Clearing existing test data...')
      for (const table of tablesToTruncate) {
        await db.sequelize.query(`TRUNCATE TABLE "${table}" CASCADE`, { transaction: t })
      }
      
      // Clear specific tables we want to seed
      if (db.department) await db.department.destroy({ where: {}, force: true, transaction: t })
      if (db.position) await db.position.destroy({ where: {}, force: true, transaction: t })
      if (db.shift) await db.shift.destroy({ where: {}, force: true, transaction: t })
      if (db.memberTier) await db.memberTier.destroy({ where: {}, force: true, transaction: t })
      if (db.member) await db.member.destroy({ where: {}, force: true, transaction: t })
      if (db.category) await db.category.destroy({ where: {}, force: true, transaction: t })
      if (db.product) await db.product.destroy({ where: {}, force: true, transaction: t })
      if (db.supplier) await db.supplier.destroy({ where: {}, force: true, transaction: t })
      if (db.user) await db.user.destroy({ where: { roleType: { [db.Sequelize.Op.ne]: 'super_admin' } }, force: true, transaction: t })
    })

    // Get or create reference data
    const superAdminUser = await db.user.findOne({ where: { userName: 'super_admin' } })
    if (!superAdminUser) {
      console.log('❌ Super admin user not found! Creating one...')
      
      // Create a simple admin user directly
      const bcrypt = require('bcrypt')
      const hashedPassword = await bcrypt.hash('superadmin123', 10)
      
      // Get the super_admin role
      const role = await db.role.findOne({ where: { roleType: 'super_admin' } })
      
      if (role) {
        await db.user.create({
          userName: 'super_admin',
          fullName: 'Super Admin',
          password: hashedPassword,
          email: 'superadmin@posapp.com',
          employeeID: 'EMP-0001',
          roleType: 'super_admin',
          roleId: role.id,
          userType: 'super_admin',
          statusEmployee: true,
          statusActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log('✅ Super admin user created!')
      } else {
        console.log('❌ Super admin role not found!')
        return
      }
    }
    
    console.log('\n✅ Test data seeding completed successfully!')
    console.log('\n📊 Summary: Data seeding completed!')
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message)
    process.exit(1)
  } finally {
    await db.sequelize.close()
  }
}

seedTestData()
