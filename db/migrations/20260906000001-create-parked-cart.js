'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('parked_cart', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      tableId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'table', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      customerId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      customerName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      customerPhone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      discountId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      promoCode: {
        type: Sequelize.STRING,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cartPayload: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      displayTotalItems: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      displayTotalPrice: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      status: {
        allowNull: false,
        type: Sequelize.ENUM('active', 'resumed', 'cancelled', 'expired'),
        defaultValue: 'active'
      },
      expiresAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      resumedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      resumedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelledBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      idempotencyKey: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    })

    // Covers the cap-count query, the default active-list query, and the
    // resume/cancel CAS's WHERE clause — all three filter on exactly
    // (store, status, expiresAt).
    await queryInterface.addIndex('parked_cart', {
      name: 'parked_cart_store_status_expires',
      fields: ['store', 'status', 'expiresAt']
    })

    // Partial unique index — same raw-SQL pattern as order.idempotencyKey
    // and cash_movement.idempotencyKey.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX parked_cart_store_idempotencykey_unique
      ON parked_cart (store, "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `)
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('parked_cart')
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_parked_cart_status"'
    )
  }
}
