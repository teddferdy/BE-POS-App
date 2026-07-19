'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_product') IS NOT NULL AS exists`
    )
    const tableExists = tableCheck[0].exists

    if (!tableExists) {
      await queryInterface.createTable('supplier_product', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        supplier: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        product: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        price: {
          type: Sequelize.INTEGER,
          defaultValue: 0
        },
        createdBy: {
          type: Sequelize.INTEGER
        },
        modifiedBy: {
          type: Sequelize.INTEGER
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        deletedAt: {
          type: Sequelize.DATE
        }
      })

      await queryInterface.addConstraint('supplier_product', {
        fields: ['supplier', 'product'],
        type: 'unique',
        name: 'uq_supplier_product_supplier_product'
      })

      await queryInterface.addIndex('supplier_product', ['supplier'], {
        where: { deletedAt: null }
      })
      await queryInterface.addIndex('supplier_product', ['product'], {
        where: { deletedAt: null }
      })
    }

    // Migrate existing product.supplier data → junction rows
    const [colCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'product' AND column_name = 'supplier' AND table_schema = 'public'`
    )
    const supplierColumnExists = colCheck.length > 0

    if (supplierColumnExists) {
      await queryInterface.sequelize.query(`
        INSERT INTO supplier_product ("supplier", "product", "price", "createdAt", "updatedAt")
        SELECT
          p.supplier AS supplier,
          p.id AS product,
          COALESCE(p."costPrice", 0) AS price,
          NOW(),
          NOW()
        FROM product p
        WHERE p.supplier IS NOT NULL
          AND p."deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM supplier_product sp
            WHERE sp.supplier = p.supplier AND sp.product = p.id
          )
      `)

      // Drop the supplier column from product
      await queryInterface.removeColumn('product', 'supplier')
    }
  },

  async down(queryInterface, Sequelize) {
    const [colCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'product' AND column_name = 'supplier' AND table_schema = 'public'`
    )
    const supplierColumnExists = colCheck.length > 0

    if (!supplierColumnExists) {
      await queryInterface.addColumn('product', 'supplier', {
        type: Sequelize.INTEGER,
        allowNull: true
      })

      // Migrate junction rows → product.supplier (take first supplier per product)
      await queryInterface.sequelize.query(`
        UPDATE product p
        SET supplier = (
          SELECT sp.supplier
          FROM supplier_product sp
          WHERE sp.product = p.id AND sp."deletedAt" IS NULL
          ORDER BY sp.id ASC
          LIMIT 1
        )
        WHERE EXISTS (
          SELECT 1 FROM supplier_product sp
          WHERE sp.product = p.id AND sp."deletedAt" IS NULL
        )
      `)
    }

    await queryInterface.dropTable('supplier_product')
  }
}
