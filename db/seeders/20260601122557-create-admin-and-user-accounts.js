'use strict'

const bcrypt = require('bcrypt')

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get role IDs
    const roles = await queryInterface.sequelize.query(
      `SELECT id, "roleType" FROM role WHERE "roleType" IN ('admin', 'user');`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    const adminRoleId = roles.find(r => r.roleType === 'admin')?.id
    const userRoleId = roles.find(r => r.roleType === 'user')?.id

    if (!adminRoleId || !userRoleId) {
      console.log('Required roles not found')
      return
    }

    // Check if users already exist
    const existingUsers = await queryInterface.sequelize.query(
      `SELECT "userName" FROM "user" WHERE "userName" IN ('admin', 'user1', 'user2');`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    const existingUsernames = existingUsers.map(u => u.userName)

    const users = []

    // Admin user
    if (!existingUsernames.includes('admin')) {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      users.push({
        userName: 'admin',
        password: hashedPassword,
        email: 'admin@posapp.com',
        roleType: 'admin',
        roleId: adminRoleId,
        userType: 'admin',
        statusEmployee: true,
        statusActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    // Regular user 1
    if (!existingUsernames.includes('user1')) {
      const hashedPassword = await bcrypt.hash('user123', 10)
      users.push({
        userName: 'user1',
        password: hashedPassword,
        email: 'user1@posapp.com',
        roleType: 'user',
        roleId: userRoleId,
        userType: 'user',
        statusEmployee: true,
        statusActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    // Regular user 2
    if (!existingUsernames.includes('user2')) {
      const hashedPassword = await bcrypt.hash('user123', 10)
      users.push({
        userName: 'user2',
        password: hashedPassword,
        email: 'user2@posapp.com',
        roleType: 'user',
        roleId: userRoleId,
        userType: 'user',
        statusEmployee: true,
        statusActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    if (users.length > 0) {
      await queryInterface.bulkInsert('user', users)
      console.log(`Created ${users.length} user accounts`)
      users.forEach(u => {
        console.log(`Username: ${u.userName}, Password: ${u.roleType === 'admin' ? 'admin123' : 'user123'}`)
      })
    } else {
      console.log('All user accounts already exist')
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('user', { userName: { [Sequelize.Op.in]: ['admin', 'user1', 'user2'] } }, {})
  }
}
