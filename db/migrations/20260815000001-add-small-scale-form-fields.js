'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('table')
    if (!tableDesc.area) {
      await queryInterface.addColumn('table', 'area', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'indoor'
      })
    }
    if (!tableDesc.tableType) {
      await queryInterface.addColumn('table', 'tableType', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'regular'
      })
    }

    const categoryDesc = await queryInterface.describeTable('category')
    if (!categoryDesc.parentId) {
      await queryInterface.addColumn('category', 'parentId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      })
    }
    if (!categoryDesc.color) {
      await queryInterface.addColumn('category', 'color', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: '#0f172a'
      })
    }
    if (!categoryDesc.sortOrder) {
      await queryInterface.addColumn('category', 'sortOrder', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      })
    }

    const typePaymentDesc = await queryInterface.describeTable('type_payment')
    if (!typePaymentDesc.feeType) {
      await queryInterface.addColumn('type_payment', 'feeType', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'fixed'
      })
    }
    if (!typePaymentDesc.fee) {
      await queryInterface.addColumn('type_payment', 'fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
      })
    }
    if (!typePaymentDesc.tenor) {
      await queryInterface.addColumn('type_payment', 'tenor', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      })
    }
    if (!typePaymentDesc.sortOrder) {
      await queryInterface.addColumn('type_payment', 'sortOrder', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      })
    }

    const stockTransferDesc = await queryInterface.describeTable('stock_transfer')
    if (!stockTransferDesc.reason) {
      await queryInterface.addColumn('stock_transfer', 'reason', {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null
      })
    }
    if (!stockTransferDesc.expectedArrival) {
      await queryInterface.addColumn('stock_transfer', 'expectedArrival', {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null
      })
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('stock_transfer', 'expectedArrival')
    await queryInterface.removeColumn('stock_transfer', 'reason')
    await queryInterface.removeColumn('type_payment', 'sortOrder')
    await queryInterface.removeColumn('type_payment', 'tenor')
    await queryInterface.removeColumn('type_payment', 'fee')
    await queryInterface.removeColumn('type_payment', 'feeType')
    await queryInterface.removeColumn('category', 'sortOrder')
    await queryInterface.removeColumn('category', 'color')
    await queryInterface.removeColumn('category', 'parentId')
    await queryInterface.removeColumn('table', 'tableType')
    await queryInterface.removeColumn('table', 'area')
  }
}
