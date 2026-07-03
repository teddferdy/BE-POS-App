module.exports = {
  up: async (queryInterface, Sequelize) => {
    const allTrue = (menu) => ({
      menu,
      create: true,
      read: true,
      update: true,
      delete: true,
      download: true,
      upload: true
    })

    const superAdminMenu = JSON.stringify([
      allTrue("dashboard"),
      allTrue("home"),
      allTrue("cash-register/current"),
      allTrue("kitchen-display"),
      allTrue("qr-order-management"),
      allTrue("location"),
      allTrue("product"),
      allTrue("category"),
      allTrue("supplier"),
      allTrue("ingredient"),
      allTrue("ingredient-category"),
      allTrue("discount"),
      allTrue("table"),
      allTrue("purchase-order"),
      allTrue("ap-dashboard"),
      allTrue("purchase-payment"),
      allTrue("goods-receipt"),
      allTrue("purchase-return"),
      allTrue("sales-return"),
      allTrue("accounts-receivable"),
      allTrue("stock-opname"),
      allTrue("stock-history"),
      allTrue("low-stock"),
      allTrue("stock-adjustment"),
      allTrue("stock-transfer"),
      allTrue("production-order"),
      allTrue("bom"),
      allTrue("expense-category"),
      allTrue("expense"),
      allTrue("member-tier"),
      allTrue("member"),
      allTrue("department"),
      allTrue("position"),
      allTrue("employee"),
      allTrue("shift"),
      allTrue("report/sales"),
      allTrue("best-selling"),
      allTrue("report/daily"),
      allTrue("report/profit-loss"),
      allTrue("report/cash-flow"),
      allTrue("invoice"),
      allTrue("tax"),
      allTrue("type-payment"),
      allTrue("role-management"),
      allTrue("price-template"),
      allTrue("reservation"),
      allTrue("backup"),
      allTrue("settings")
    ])

    const adminMenu = JSON.stringify([
      { menu: "dashboard", read: true },
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
    ])

    const userMenu = JSON.stringify([
      { menu: "dashboard", read: true },
      { menu: "member", read: true },
      { menu: "report/sales", read: true },
      { menu: "best-selling", read: true }
    ])

    await queryInterface.sequelize.query(
      `UPDATE role SET "accessMenu" = :menu::jsonb, "updatedAt" = NOW() WHERE "roleType" = 'super_admin'`,
      { replacements: { menu: superAdminMenu } }
    )

    await queryInterface.sequelize.query(
      `UPDATE role SET "accessMenu" = :menu::jsonb, "updatedAt" = NOW() WHERE "roleType" = 'admin' AND "name" = 'Admin Toko'`,
      { replacements: { menu: adminMenu } }
    )

    await queryInterface.sequelize.query(
      `UPDATE role SET "accessMenu" = :menu::jsonb, "updatedAt" = NOW() WHERE "roleType" = 'user' AND "name" = 'Staff/Karyawan'`,
      { replacements: { menu: userMenu } }
    )
  },

  down: async (queryInterface, Sequelize) => {
    const oldSuperAdmin = JSON.stringify([
      { menu: "dashboard", create: true, read: true, update: true, delete: true, download: true, upload: true },
      { menu: "location", create: true, read: true, update: true, delete: true, download: true, upload: true },
      { menu: "user", create: true, read: true, update: true, delete: true, download: true, upload: true },
      { menu: "product", create: true, read: true, update: true, delete: true, download: true, upload: true },
      { menu: "category", create: true, read: true, update: true, delete: true, download: true, upload: true },
      { menu: "report", create: true, read: true, update: true, delete: true, download: true, upload: true },
      { menu: "settings", create: true, read: true, update: true, delete: true, download: true, upload: true }
    ])

    const oldAdmin = JSON.stringify([
      { menu: "dashboard", create: true, read: true, update: false, delete: false, download: true, upload: false },
      { menu: "product", create: true, read: true, update: true, delete: true, download: true, upload: true },
      { menu: "category", create: true, read: true, update: true, delete: true, download: false, upload: true },
      { menu: "user", create: true, read: true, update: true, delete: false, download: false, upload: false },
      { menu: "report", create: false, read: true, update: false, delete: false, download: true, upload: false }
    ])

    await queryInterface.sequelize.query(
      `UPDATE role SET "accessMenu" = :menu::jsonb, "updatedAt" = NOW() WHERE "roleType" = 'super_admin'`,
      { replacements: { menu: oldSuperAdmin } }
    )

    await queryInterface.sequelize.query(
      `UPDATE role SET "accessMenu" = :menu::jsonb, "updatedAt" = NOW() WHERE "roleType" = 'admin' AND "name" = 'Admin Toko'`,
      { replacements: { menu: oldAdmin } }
    )

    const oldUser = JSON.stringify([
      { menu: "dashboard", create: false, read: true, update: false, delete: false, download: false, upload: false },
      { menu: "pos", create: true, read: true, update: true, delete: false, download: false, upload: false },
      { menu: "product", create: false, read: true, update: false, delete: false, download: false, upload: false }
    ])

    await queryInterface.sequelize.query(
      `UPDATE role SET "accessMenu" = :menu::jsonb, "updatedAt" = NOW() WHERE "roleType" = 'user' AND "name" = 'Staff/Karyawan'`,
      { replacements: { menu: oldUser } }
    )
  }
}
