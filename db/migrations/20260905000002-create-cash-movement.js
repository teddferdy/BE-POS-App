'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cash_movement', {
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
      cashRegisterId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'cash_register', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        allowNull: false,
        type: Sequelize.ENUM('cash_in', 'cash_out')
      },
      reasonCode: {
        allowNull: false,
        type: Sequelize.ENUM(
          'float_topup',
          'bank_drop',
          'petty_cash',
          'owner_draw',
          'change_fund',
          'correction',
          'other'
        )
      },
      amount: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        allowNull: false,
        type: Sequelize.ENUM(
          'pending_approval',
          'active',
          'rejected',
          'reversed'
        )
      },
      reversalOfId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'cash_movement', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      approvedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      approvedAt: {
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

    await queryInterface.addIndex('cash_movement', {
      name: 'cash_movement_register_status',
      fields: ['cashRegisterId', 'status']
    })

    // Partial unique index — same raw-SQL pattern as order.idempotencyKey
    // and purchase_payment.idempotencyKey.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX cash_movement_register_idempotencykey_unique
      ON cash_movement ("cashRegisterId", "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `)
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('cash_movement')
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_cash_movement_type"'
    )
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_cash_movement_reasonCode"'
    )
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_cash_movement_status"'
    )
  }
}
