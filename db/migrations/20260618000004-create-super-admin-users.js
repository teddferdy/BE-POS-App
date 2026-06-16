'use strict'
const bcrypt = require('bcrypt')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const roles = await queryInterface.sequelize.query(
      `SELECT id FROM role WHERE "roleType" = 'super_admin' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    if (roles.length === 0) {
      console.log('Super Admin role not found. Skipping migration.')
      return
    }

    const superAdminRoleId = roles[0].id
    const hashedPassword = await bcrypt.hash('admin123', 10)

    const users = [
      {
        userName: 'fabiola.rosa',
        fullName: 'Fabiola Rosa',
        password: hashedPassword,
        email: 'fabiola@posapp.com',
        roleType: 'super_admin',
        roleId: superAdminRoleId,
        userType: 'super_admin',
        statusEmployee: true,
        statusActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userName: 'surya',
        fullName: 'Surya',
        password: hashedPassword,
        email: 'surya@posapp.com',
        roleType: 'super_admin',
        roleId: superAdminRoleId,
        userType: 'super_admin',
        statusEmployee: true,
        statusActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userName: 'angga',
        fullName: 'Angga',
        password: hashedPassword,
        email: 'angga@posapp.com',
        roleType: 'super_admin',
        roleId: superAdminRoleId,
        userType: 'super_admin',
        statusEmployee: true,
        statusActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    for (const user of users) {
      const existing = await queryInterface.sequelize.query(
        `SELECT id FROM "user" WHERE "userName" = :userName LIMIT 1;`,
        { replacements: { userName: user.userName }, type: Sequelize.QueryTypes.SELECT }
      )
      if (!existing.length) {
        await queryInterface.bulkInsert('user', [user])
        console.log(`Super Admin user "${user.fullName}" created successfully!`)
      } else {
        console.log(`Super Admin user "${user.fullName}" already exists. Skipping.`)
      }
    }

    console.log('')
    console.log('Super Admin users created/verified:')
    console.log('  fabiola.rosa / admin123')
    console.log('  surya / admin123')
    console.log('  angga / admin123')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('user', {
      userName: ['fabiola.rosa', 'surya', 'angga']
    })
  }
}
