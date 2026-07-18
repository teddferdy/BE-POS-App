'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create junction table
    await queryInterface.createTable('category_store', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      category: {
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

    await queryInterface.addConstraint('category_store', {
      fields: ['category', 'store'],
      type: 'unique',
      name: 'uq_category_store_category_store'
    })

    await queryInterface.addIndex('category_store', ['category'], {
      where: { deletedAt: null }
    })
    await queryInterface.addIndex('category_store', ['store'], {
      where: { deletedAt: null }
    })

    // 2. Migrate JSONB data → junction rows
    await queryInterface.sequelize.query(`
      INSERT INTO category_store ("category", "store", "createdAt", "updatedAt")
      SELECT
        c.id AS category,
        sv::int AS store,
        NOW(),
        NOW()
      FROM category c,
           jsonb_array_elements_text(c.store) AS sv
      WHERE c.store IS NOT NULL
        AND jsonb_array_length(c.store) > 0
        AND c."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM category_store cs
          WHERE cs.category = c.id AND cs.store = sv::int
        )
    `)

    // 3. Drop the JSONB store column from category
    await queryInterface.removeColumn('category', 'store')
  },

  async down(queryInterface, Sequelize) {
    // 1. Add back the JSONB store column
    await queryInterface.addColumn('category', 'store', {
      type: Sequelize.JSONB
    })

    // 2. Migrate junction rows → JSONB
    await queryInterface.sequelize.query(`
      UPDATE category c
      SET store = (
        SELECT jsonb_agg(cs.store ORDER BY cs.store)
        FROM category_store cs
        WHERE cs.category = c.id AND cs."deletedAt" IS NULL
      )
      WHERE EXISTS (
        SELECT 1 FROM category_store cs
        WHERE cs.category = c.id AND cs."deletedAt" IS NULL
      )
    `)

    // 3. Drop junction table
    await queryInterface.dropTable('category_store')
  }
}
