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

    // Check if super admin user already exists
    const existingUser = await queryInterface.sequelize.query(
      `SELECT id FROM "user" WHERE "roleType" = 'super_admin' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    if (existingUser.length > 0) {
      await queryInterface.sequelize.query(
        `UPDATE "user" SET "fullName" = 'Super Admin' WHERE "roleType" = 'super_admin' AND ("fullName" IS NULL OR "fullName" = '');`
      )
      console.log('Super Admin user already exists. Full name updated.')
      return
    }

    const hashedPassword = await bcrypt.hash('superadmin123', 10)

    const superAdminUser = {
      userName: 'super_admin',
      fullName: 'Super Admin',
      password: hashedPassword,
      email: 'superadmin@posapp.com',
      employeeID: 'EMP-0001',
      roleType: 'super_admin',
      roleId: superAdminRoleId,
      userType: 'super_admin',
      statusEmployee: true,
      statusActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await queryInterface.bulkInsert('user', [superAdminUser])
    console.log('Super Admin user created successfully!')
    console.log('Username: super_admin')
    console.log('Password: superadmin123')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('user', { roleType: 'super_admin' }, {})
  }
}