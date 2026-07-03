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
          { menu: 'home', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'cash-register/current', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'kitchen-display', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'qr-order-management', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'location', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'product', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'category', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'supplier', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'ingredient', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'ingredient-category', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'discount', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'table', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'purchase-order', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'ap-dashboard', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'purchase-payment', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'goods-receipt', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'purchase-return', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'sales-return', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'accounts-receivable', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'stock-opname', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'stock-history', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'low-stock', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'stock-adjustment', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'stock-transfer', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'production-order', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'bom', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'expense-category', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'expense', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'member-tier', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'member', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'department', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'position', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'employee', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'shift', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'report/sales', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'best-selling', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'report/daily', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'report/profit-loss', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'report/cash-flow', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'invoice', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'tax', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'type-payment', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'role-management', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'price-template', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'reservation', create: true, read: true, update: true, delete: true, download: true, upload: true },
          { menu: 'backup', create: true, read: true, update: true, delete: true, download: true, upload: true },
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
          { menu: "dashboard", read: true, create: true, update: true, delete: true, download: true, upload: true },
          { menu: "home", read: true, create: true },
          { menu: "cash-register/current", read: true, create: true },
          { menu: "kitchen-display", read: true },
          { menu: "qr-order-management", read: true },
          { menu: "product", read: true, create: true, update: true, delete: true, upload: true, download: true },
          { menu: "category", read: true, create: true, update: true, delete: true, upload: true, download: true },
          { menu: "supplier", read: true, create: true, update: true, delete: true, upload: true, download: true },
          { menu: "ingredient", read: true, create: true, update: true, delete: true },
          { menu: "ingredient-category", read: true, create: true, update: true, delete: true, upload: true, download: true },
          { menu: "discount", read: true, create: true, update: true, delete: true },
          { menu: "table", read: true, create: true, update: true, delete: true },
          { menu: "purchase-order", read: true, create: true, update: true },
          { menu: "ap-dashboard", read: true },
          { menu: "purchase-payment", read: true },
          { menu: "goods-receipt", read: true, create: true, delete: true },
          { menu: "purchase-return", read: true },
          { menu: "sales-return", read: true },
          { menu: "accounts-receivable", read: true },
          { menu: "stock-opname", read: true, create: true },
          { menu: "stock-history", read: true },
          { menu: "low-stock", read: true },
          { menu: "stock-adjustment", read: true, create: true },
          { menu: "stock-transfer", read: true, create: true, delete: true },
          { menu: "production-order", read: true, create: true, update: true, delete: true },
          { menu: "bom", read: true, create: true, delete: true },
          { menu: "expense-category", read: true, create: true, update: true, delete: true },
          { menu: "expense", read: true, create: true },
          { menu: "member-tier", read: true, create: true, update: true, delete: true },
          { menu: "member", read: true, create: true, update: true, delete: true },
          { menu: "department", read: true, create: true, update: true, delete: true },
          { menu: "position", read: true, create: true, update: true, delete: true },
          { menu: "employee", read: true, create: true, update: true, delete: true },
          { menu: "shift", read: true, create: true, update: true, delete: true },
          { menu: "report/sales", read: true, download: true },
          { menu: "best-selling", read: true, download: true },
          { menu: "report/daily", read: true },
          { menu: "report/profit-loss", read: true },
          { menu: "report/cash-flow", read: true },
          { menu: "invoice", read: true },
          { menu: "tax", read: true },
          { menu: "type-payment", read: true },
          { menu: "price-template", read: true },
          { menu: "reservation", read: true }
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
          { menu: 'dashboard', read: true },
          { menu: 'member', read: true },
          { menu: 'report/sales', read: true },
          { menu: 'best-selling', read: true }
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
