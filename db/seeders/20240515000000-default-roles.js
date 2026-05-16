'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const defaultRoles = [
      {
        name: 'Super Admin',
        roleType: 'super_admin',
        store: null,
        accessMenu: JSON.stringify([
          {
            menu: 'dashboard',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: true,
            upload: true
          },
          {
            menu: 'location',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: true,
            upload: true
          },
          {
            menu: 'user',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: true,
            upload: true
          },
          {
            menu: 'product',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: true,
            upload: true
          },
          {
            menu: 'category',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: true,
            upload: true
          },
          {
            menu: 'report',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: true,
            upload: true
          },
          {
            menu: 'settings',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: true,
            upload: true
          }
        ]),
        status: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Admin Toko',
        roleType: 'admin',
        store: null,
        accessMenu: JSON.stringify([
          {
            menu: 'dashboard',
            create: true,
            read: true,
            update: false,
            delete: false,
            download: true,
            upload: false
          },
          {
            menu: 'product',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: true,
            upload: true
          },
          {
            menu: 'category',
            create: true,
            read: true,
            update: true,
            delete: true,
            download: false,
            upload: true
          },
          {
            menu: 'user',
            create: true,
            read: true,
            update: true,
            delete: false,
            download: false,
            upload: false
          },
          {
            menu: 'report',
            create: false,
            read: true,
            update: false,
            delete: false,
            download: true,
            upload: false
          }
        ]),
        status: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Staff/Karyawan',
        roleType: 'user',
        store: null,
        accessMenu: JSON.stringify([
          {
            menu: 'dashboard',
            create: false,
            read: true,
            update: false,
            delete: false,
            download: false,
            upload: false
          },
          {
            menu: 'pos',
            create: true,
            read: true,
            update: true,
            delete: false,
            download: false,
            upload: false
          },
          {
            menu: 'product',
            create: false,
            read: true,
            update: false,
            delete: false,
            download: false,
            upload: false
          }
        ]),
        status: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    await queryInterface.bulkInsert('role', defaultRoles)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('role', null, {})
  }
}