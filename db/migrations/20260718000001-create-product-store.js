'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create junction table
    await queryInterface.createTable('product_store', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      product: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      store: {
        allowNull: false,
        type: Sequelize.INTEGER
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

    await queryInterface.addConstraint('product_store', {
      fields: ['product', 'store'],
      type: 'unique',
      name: 'uq_product_store_product_store'
    })

    await queryInterface.addIndex('product_store', ['product'], {
      where: { deletedAt: null }
    })
    await queryInterface.addIndex('product_store', ['store'], {
      where: { deletedAt: null }
    })

    // 2. Migrate JSONB data → junction rows
    await queryInterface.sequelize.query(`
      INSERT INTO product_store ("product", "store", "createdAt", "updatedAt")
      SELECT
        p.id AS product,
        value::int AS store,
        NOW(),
        NOW()
      FROM product p,
           jsonb_array_elements_text(p.store) AS value
      WHERE p.store IS NOT NULL
        AND jsonb_array_length(p.store) > 0
        AND p."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM product_store ps
          WHERE ps.product = p.id AND ps.store = value::int
        )
    `)

    // 3. Drop the JSONB store column from product
    await queryInterface.removeColumn('product', 'store')
  },

  async down(queryInterface, Sequelize) {
    // 1. Add back the JSONB store column
    await queryInterface.addColumn('product', 'store', {
      type: Sequelize.JSONB
    })

    // 2. Migrate junction rows → JSONB
    await queryInterface.sequelize.query(`
      UPDATE product p
      SET store = (
        SELECT jsonb_agg(ps.store ORDER BY ps.store)
        FROM product_store ps
        WHERE ps.product = p.id AND ps."deletedAt" IS NULL
      )
      WHERE EXISTS (
        SELECT 1 FROM product_store ps
        WHERE ps.product = p.id AND ps."deletedAt" IS NULL
      )
    `)

    // 3. Drop junction table
    await queryInterface.dropTable('product_store')
  }
}
