'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const expenseDesc = await queryInterface.describeTable('expense')

    if (!expenseDesc.isPaid) {
      await queryInterface.addColumn('expense', 'isPaid', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      })
    }

    if (!expenseDesc.paidAt) {
      await queryInterface.addColumn('expense', 'paidAt', {
        type: Sequelize.DATE,
        allowNull: true
      })
    }

    const tables = await queryInterface.showAllTables()
    if (!tables.includes('expense_payment')) {
      await queryInterface.createTable('expense_payment', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        expenseId: {
          allowNull: false,
          type: Sequelize.INTEGER,
          references: { model: 'expense', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        store: {
          type: Sequelize.INTEGER
        },
        amount: {
          type: Sequelize.INTEGER,
          defaultValue: 0
        },
        paymentDate: {
          type: Sequelize.DATE
        },
        paymentMethod: {
          type: Sequelize.STRING
        },
        note: {
          type: Sequelize.TEXT
        },
        createdBy: {
          type: Sequelize.INTEGER,
          references: { model: 'user', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        deletedAt: {
          type: Sequelize.DATE
        }
      })
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('expense_payment')
    await queryInterface.removeColumn('expense', 'paidAt')
    await queryInterface.removeColumn('expense', 'isPaid')
  }
}
