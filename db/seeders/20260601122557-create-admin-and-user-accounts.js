'use strict'

const bcrypt = require('bcrypt')

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get role IDs
    const roles = await queryInterface.sequelize.query(
      `SELECT id, "roleType" FROM role WHERE "roleType" IN ('admin', 'cashier', 'user');`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    const adminRoleId = roles.find(r => r.roleType === 'admin')?.id
    const cashierRoleId = roles.find(r => r.roleType === 'cashier')?.id
    const userRoleId = roles.find(r => r.roleType === 'user')?.id

    if (!adminRoleId || !userRoleId) {
      console.log('Required roles not found')
      return
    }

    // Check if users already exist
    const existingUsers = await queryInterface.sequelize.query(
      `SELECT "userName" FROM "user" WHERE "userName" IN ('admin', 'kasir_utama', 'staff_gudang');`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    const existingUsernames = existingUsers.map(u => u.userName)

    const users = []

    // Admin user (full access to store operations)
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

    // Kasir Utama (cashier role - can access cashier, products, members)
    if (!existingUsernames.includes('kasir_utama')) {
      const hashedPassword = await bcrypt.hash('kasir123', 10)
      users.push({
        userName: 'kasir_utama',
        password: hashedPassword,
        email: 'kasir@posapp.com',
        roleType: cashierRoleId ? 'cashier' : 'user',
        roleId: cashierRoleId || userRoleId,
        userType: cashierRoleId ? 'cashier' : 'user',
        statusEmployee: true,
        statusActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    // Staff Gudang (limited user role - inventory & reports only)
    if (!existingUsernames.includes('staff_gudang')) {
      const hashedPassword = await bcrypt.hash('staff123', 10)
      users.push({
        userName: 'staff_gudang',
        password: hashedPassword,
        email: 'staff@posapp.com',
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
        console.log(`Username: ${u.userName}, Password: ${u.roleType === 'admin' ? 'admin123' : u.userName === 'kasir_utama' ? 'kasir123' : 'staff123'}`)
      })
    } else {
      console.log('All user accounts already exist')
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('user', { userName: { [Sequelize.Op.in]: ['admin', 'kasir_utama', 'staff_gudang'] } }, {})
  }
}
