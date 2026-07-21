'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_product') IS NOT NULL AS exists`
    )
    if (!tableCheck[0].exists) return

    // 1. Add new columns
    const [colCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'supplier_product' AND table_schema = 'public'
       ORDER BY ordinal_position`
    )
    const existingCols = colCheck.map((c) => c.column_name)

    if (!existingCols.includes('productId')) {
      await queryInterface.addColumn('supplier_product', 'productId', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }
    if (!existingCols.includes('leadTime')) {
      await queryInterface.addColumn('supplier_product', 'leadTime', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      })
    }
    if (!existingCols.includes('qualityRating')) {
      await queryInterface.addColumn('supplier_product', 'qualityRating', {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      })
    }
    if (!existingCols.includes('minOrderQty')) {
      await queryInterface.addColumn('supplier_product', 'minOrderQty', {
        type: Sequelize.INTEGER,
        defaultValue: 1
      })
    }
    if (!existingCols.includes('lastPrice')) {
      await queryInterface.addColumn('supplier_product', 'lastPrice', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      })
    }

    // 2. Migrate name → productId by matching product.nameProduct
    await queryInterface.sequelize.query(`
      UPDATE supplier_product sp
      SET "productId" = p.id
      FROM product p
      WHERE sp."productId" IS NULL
        AND LOWER(TRIM(sp.name)) = LOWER(TRIM(p."nameProduct"))
        AND p."deletedAt" IS NULL
    `)

    // 3. Add FK constraint on productId
    const [fkCheck] = await queryInterface.sequelize.query(
      `SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_supplier_product_product'
       AND conrelid = 'supplier_product'::regclass`
    )
    if (fkCheck.length === 0) {
      await queryInterface.addConstraint('supplier_product', {
        fields: ['productId'],
        type: 'foreign key',
        name: 'fk_supplier_product_product',
        references: { table: 'product', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      })
    }

    // 4. Add unique constraint on (supplier, productId) where productId is not null
    //    Drop old unique constraint first
    const [oldConstraintCheck] = await queryInterface.sequelize.query(
      `SELECT conname FROM pg_constraint
       WHERE conname = 'uq_supplier_product_supplier_name'
       AND conrelid = 'supplier_product'::regclass`
    )
    if (oldConstraintCheck.length > 0) {
      await queryInterface.removeConstraint('supplier_product', 'uq_supplier_product_supplier_name')
    }

    // Create partial unique index instead (allows multiple rows where productId is null)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_supplier_product_supplier_productId"
      ON "supplier_product" ("supplier", "productId")
      WHERE "productId" IS NOT NULL AND "deletedAt" IS NULL
    `)

    // 5. Add index on productId
    await queryInterface.addIndex('supplier_product', ['productId'], {
      where: { deletedAt: null }
    })

    // 6. Add composite indexes for comparison queries
    await queryInterface.addIndex('supplier_product', ['productId', 'price'], {
      where: { deletedAt: null, productId: { [Sequelize.Op.ne]: null } },
      name: 'idx_supplier_product_price_compare'
    })
  },

  async down(queryInterface, Sequelize) {
    // Remove new indexes
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "uq_supplier_product_supplier_productId"
    `)
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "idx_supplier_product_price_compare"
    `)

    // Remove new columns
    const cols = ['lastPrice', 'minOrderQty', 'qualityRating', 'leadTime', 'productId']
    for (const col of cols) {
      const [check] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'supplier_product' AND column_name = '${col}' AND table_schema = 'public'`
      )
      if (check.length > 0) {
        await queryInterface.removeColumn('supplier_product', col)
      }
    }

    // Restore old unique constraint
    await queryInterface.addConstraint('supplier_product', {
      fields: ['supplier', 'name'],
      type: 'unique',
      name: 'uq_supplier_product_supplier_name'
    })
  }
}
