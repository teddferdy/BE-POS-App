'use strict'

const bcrypt = require('bcrypt')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if super admin role exists
    const roles = await queryInterface.sequelize.query(
      `SELECT id FROM role WHERE "roleType" = 'super_admin' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    if (roles.length === 0) {
      console.log('Super Admin role not found. Please run role seeder first.')
      return
    }

    const superAdminRoleId = roles[0].id

    const hashedPasswordAngga = await bcrypt.hash('angga123', 10)
    const hashedPasswordFebi = await bcrypt.hash('febi123', 10)
    const hashedPasswordSurya = await bcrypt.hash('surya123', 10)
    const hashedPasswordTegar = await bcrypt.hash('tegar123', 10)
    const hashedPasswordLuthfi = await bcrypt.hash('luthfi123', 10)
    const hashedPasswordSuperAdmin = await bcrypt.hash('superadmin123', 10)

    const allUsers = [
      { userName: 'angga', fullName: 'angga', password: hashedPasswordAngga, email: 'angga@posapp.com', employeeID: 'EMP-0002' },
      { userName: 'luthfi', fullName: 'luthfi', password: hashedPasswordLuthfi, email: 'luthfi@posapp.com', employeeID: 'EMP-0003' },
      { userName: 'febi', fullName: 'febi', password: hashedPasswordFebi, email: 'febi@posapp.com', employeeID: 'EMP-0004' },
      { userName: 'surya', fullName: 'surya', password: hashedPasswordSurya, email: 'surya@posapp.com', employeeID: 'EMP-0005' },
      { userName: 'tegar', fullName: 'tegar', password: hashedPasswordTegar, email: 'tegar@posapp.com', employeeID: 'EMP-0006' },
      { userName: 'super_admin', fullName: 'Super Admin', password: hashedPasswordSuperAdmin, email: 'superadmin@posapp.com', employeeID: 'EMP-0001' }
    ]

    const [existing] = await queryInterface.sequelize.query(
      `SELECT "userName" FROM "user" WHERE "roleType" = 'super_admin'`
    )
    const existingNames = existing.map((r) => r.userName)

    const toInsert = allUsers
      .filter((u) => !existingNames.includes(u.userName))
      .map((u) => ({
        ...u,
        roleType: 'super_admin',
        roleId: superAdminRoleId,
        userType: 'super_admin',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }))

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('user', toInsert)
      console.log(`Created ${toInsert.length} super admin user(s): ${toInsert.map((u) => u.userName).join(', ')}`)
    } else {
      console.log('All super admin users already exist.')
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('user', { roleType: 'super_admin' }, {})
  }
}
