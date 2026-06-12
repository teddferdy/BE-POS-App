module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const defaultRoles = [
      {
        name: 'Super Admin',
        roleType: 'super_admin',
        store: null,
        accessMenu: JSON.stringify([
          { menu: 'dashboard', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'location', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'user', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'product', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'category', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'report', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'settings', create: true, read: true, update: true, delete: true, download: true, upload: true }
        ]),
        status: 'active',
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      },
      {
        name: 'Admin Toko',
        roleType: 'admin',
        store: null,
        accessMenu: JSON.stringify([
          { menu: 'dashboard', create: true, read: true, update: false, delete: false, download: true, upload: false },
          { menu: 'product', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'category', create: true, read: true, update: true, delete: true, download: false, upload: true },
          { menu: 'user', create: true, read: true, update: true, delete: false, download: false, upload: false },
          { menu: 'report', create: false, read: true, update: false, delete: false, download: true, upload: false }
        ]),
        status: 'active',
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      },
      {
        name: 'Kasir',
        roleType: 'kasir',
        store: null,
        accessMenu: JSON.stringify([
          { menu: 'dashboard', create: false, read: true, update: false, delete: false, download: false, upload: false },
          { menu: 'pos', create: true, read: true, update: true, delete: false, download: false, upload: false },
          { menu: 'product', create: false, read: true, update: false, delete: false, download: false, upload: false },
          { menu: 'member', create: true, read: true, update: true, delete: false, download: false, upload: false }
        ]),
        status: 'active',
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      },
      {
        name: 'Staff/Karyawan',
        roleType: 'user',
        store: null,
        accessMenu: JSON.stringify([
          { menu: 'dashboard', create: false, read: true, update: false, delete: false, download: false, upload: false },
          { menu: 'pos', create: true, read: true, update: true, delete: false, download: false, upload: false },
          { menu: 'product', create: false, read: true, update: false, delete: false, download: false, upload: false }
        ]),
        status: 'active',
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      }
    ]

    for (const role of defaultRoles) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM role WHERE "roleType" = :roleType LIMIT 1',
        { replacements: { roleType: role.roleType }, type: Sequelize.QueryTypes.SELECT }
      )
      if (!existing) {
        await queryInterface.bulkInsert('role', [role])
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('role', {
      roleType: ['super_admin', 'admin', 'kasir', 'user']
    })
  }
}
