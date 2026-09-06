'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('cash_register', 'variance', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
    await queryInterface.addColumn(
      'cash_register',
      'varianceApprovalStatus',
      {
        type: Sequelize.ENUM(
          'auto_approved',
          'pending_approval',
          'approved',
          'rejected'
        ),
        allowNull: true
      }
    )
    await queryInterface.addColumn('cash_register', 'approvedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'user', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    })
    await queryInterface.addColumn('cash_register', 'approvedAt', {
      type: Sequelize.DATE,
      allowNull: true
    })
    // New, separate column — totalSales keeps its existing meaning and
    // computation untouched (see Finding 7 in the F2 blueprint).
    await queryInterface.addColumn('cash_register', 'cashSalesReceived', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('cash_register', 'cashSalesReceived')
    await queryInterface.removeColumn('cash_register', 'approvedAt')
    await queryInterface.removeColumn('cash_register', 'approvedBy')
    await queryInterface.removeColumn(
      'cash_register',
      'varianceApprovalStatus'
    )
    await queryInterface.removeColumn('cash_register', 'variance')
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_cash_register_varianceApprovalStatus"'
    )
  }
}
