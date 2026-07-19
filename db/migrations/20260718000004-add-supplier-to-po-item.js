'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add supplier column to purchase_order_item
    const [poItemColCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'purchase_order_item' AND column_name = 'supplier' AND table_schema = 'public'`
    )
    if (poItemColCheck.length === 0) {
      await queryInterface.addColumn('purchase_order_item', 'supplier', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }

    // 2. Migrate purchase_order.supplier → purchase_order_item.supplier
    const [poColCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'purchase_order' AND column_name = 'supplier' AND table_schema = 'public'`
    )
    if (poColCheck.length > 0) {
      await queryInterface.sequelize.query(`
        UPDATE purchase_order_item poi
        SET supplier = po.supplier
        FROM purchase_order po
        WHERE poi."purchaseOrder" = po.id
          AND po.supplier IS NOT NULL
          AND poi.supplier IS NULL
      `)

      // 3. Drop supplier column from purchase_order
      await queryInterface.removeColumn('purchase_order', 'supplier')
    }
  },

  async down(queryInterface, Sequelize) {
    // 1. Add back supplier column to purchase_order
    const [poColCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'purchase_order' AND column_name = 'supplier' AND table_schema = 'public'`
    )
    if (poColCheck.length === 0) {
      await queryInterface.addColumn('purchase_order', 'supplier', {
        type: Sequelize.INTEGER,
        allowNull: true
      })

      // Migrate item suppliers back to PO level (take first item's supplier per PO)
      await queryInterface.sequelize.query(`
        UPDATE purchase_order po
        SET supplier = (
          SELECT poi.supplier
          FROM purchase_order_item poi
          WHERE poi."purchaseOrder" = po.id
            AND poi.supplier IS NOT NULL
          ORDER BY poi.id ASC
          LIMIT 1
        )
        WHERE EXISTS (
          SELECT 1 FROM purchase_order_item poi
          WHERE poi."purchaseOrder" = po.id
            AND poi.supplier IS NOT NULL
        )
      `)
    }

    // 2. Drop supplier column from purchase_order_item
    const [poItemColCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'purchase_order_item' AND column_name = 'supplier' AND table_schema = 'public'`
    )
    if (poItemColCheck.length > 0) {
      await queryInterface.removeColumn('purchase_order_item', 'supplier')
    }
  }
}
