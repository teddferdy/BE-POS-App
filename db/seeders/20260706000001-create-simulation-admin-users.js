'use strict'
const bcrypt = require('bcrypt')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const roles = await queryInterface.sequelize.query(
      `SELECT id FROM role WHERE "roleType" = 'admin' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (roles.length === 0) {
      console.log('Admin role not found. Run role seeder first.')
      return
    }
    const adminRoleId = roles[0].id

    // Grab next available ID for locations (avoid sequence issues)
    const maxIdRes = await queryInterface.sequelize.query(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM location;`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    let nextId = maxIdRes[0].next_id

    // Create locations if they don't exist
    const existingLocs = await queryInterface.sequelize.query(
      `SELECT name FROM location WHERE name IN ('Lawson', 'Family Mart');`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingLocNames = existingLocs.map((r) => r.name)

    const locs = []
    if (!existingLocNames.includes('Lawson'))
      locs.push({ id: nextId++, name: 'Lawson', store: nextId - 1, status: 'active', createdAt: new Date(), updatedAt: new Date() })
    if (!existingLocNames.includes('Family Mart'))
      locs.push({ id: nextId++, name: 'Family Mart', store: nextId - 1, status: 'active', createdAt: new Date(), updatedAt: new Date() })

    if (locs.length) {
      await queryInterface.bulkInsert('location', locs)
      // fix sequence
      await queryInterface.sequelize.query(
        `SELECT setval(pg_get_serial_sequence('location', 'id'), COALESCE(MAX(id), 1)) FROM location;`
      )
      console.log(`Created ${locs.length} location(s)`)
    }

    // Grab IDs from DB (handle both newly-inserted and pre-existing locations)
    const allLocs = await queryInterface.sequelize.query(
      `SELECT id, name FROM location WHERE name IN ('Lawson', 'Family Mart');`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const locMap = {}
    for (const l of allLocs) locMap[l.name] = l.id

    // Create admin users
    const hashed = await bcrypt.hash('admin123', 10)

    const existingUsers = await queryInterface.sequelize.query(
      `SELECT "userName" FROM "user" WHERE "userName" IN ('admin_lawson', 'admin_family_mart');`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingU = existingUsers.map((u) => u.userName)

    const users = []
    if (!existingU.includes('admin_lawson') && locMap['Lawson'])
      users.push({
        userName: 'admin_lawson',
        fullName: 'Admin Lawson',
        password: hashed,
        email: 'admin.lawson@posapp.com',
        roleType: 'admin',
        roleId: adminRoleId,
        userType: 'admin',
        store: locMap['Lawson'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      })
    if (!existingU.includes('admin_family_mart') && locMap['Family Mart'])
      users.push({
        userName: 'admin_family_mart',
        fullName: 'Admin Family Mart',
        password: hashed,
        email: 'admin.familymart@posapp.com',
        roleType: 'admin',
        roleId: adminRoleId,
        userType: 'admin',
        store: locMap['Family Mart'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      })

    if (users.length) {
      // Use next available IDs to avoid sequence issues
      const maxUserRes = await queryInterface.sequelize.query(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM "user";`,
        { type: Sequelize.QueryTypes.SELECT }
      )
      let userId = maxUserRes[0].next_id
      const usersWithId = users.map((u) => ({ id: userId++, ...u }))

      await queryInterface.bulkInsert('user', usersWithId)
      await queryInterface.sequelize.query(
        `SELECT setval(pg_get_serial_sequence('user', 'id'), COALESCE(MAX(id), 1)) FROM "user";`
      )
      console.log(`Created ${users.length} admin user(s)`)
    }

    console.log('')
    console.log('Simulation admin users:')
    console.log('  Lawson / admin_lawson / admin123')
    console.log('  Family Mart / admin_family_mart / admin123')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('user', {
      userName: ['admin_lawson', 'admin_family_mart']
    })
    try {
      await queryInterface.sequelize.query(
        `DELETE FROM location WHERE name IN ('Lawson', 'Family Mart');`
      )
    } catch {
      console.log('Location deletion skipped (referenced by other tables)')
    }
  }
}
