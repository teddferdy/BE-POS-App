'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sales_summary', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: { type: Sequelize.INTEGER, allowNull: false },
      report_date: { type: Sequelize.DATEONLY, allowNull: false },
      total_sales: { type: Sequelize.DECIMAL(15, 2) },
      total_transactions: { type: Sequelize.INTEGER },
      total_items: { type: Sequelize.INTEGER },
      average_transaction: { type: Sequelize.DECIMAL(15, 2) },
      total_discount: { type: Sequelize.DECIMAL(15, 2) },
      total_tax: { type: Sequelize.DECIMAL(15, 2) },
      payment_cash: { type: Sequelize.DECIMAL(15, 2) },
      payment_card: { type: Sequelize.DECIMAL(15, 2) },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('sales_summary', ['store', 'report_date'])
    await queryInterface.addIndex('sales_summary', ['report_date'])

    await queryInterface.createTable('product_sales_summary', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      store: { type: Sequelize.INTEGER, allowNull: false },
      product: { type: Sequelize.INTEGER, allowNull: false },
      report_date: { type: Sequelize.DATEONLY, allowNull: false },
      quantity_sold: { type: Sequelize.INTEGER },
      revenue: { type: Sequelize.DECIMAL(15, 2) },
      cost: { type: Sequelize.DECIMAL(15, 2) },
      profit: { type: Sequelize.DECIMAL(15, 2) },
      transactions: { type: Sequelize.INTEGER },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('product_sales_summary', ['store', 'product', 'report_date'])
    await queryInterface.addIndex('product_sales_summary', ['report_date'])

    await queryInterface.createTable('category_sales_summary', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      store: { type: Sequelize.INTEGER, allowNull: false },
      category: { type: Sequelize.INTEGER, allowNull: false },
      report_date: { type: Sequelize.DATEONLY, allowNull: false },
      quantity_sold: { type: Sequelize.INTEGER },
      revenue: { type: Sequelize.DECIMAL(15, 2) },
      cost: { type: Sequelize.DECIMAL(15, 2) },
      profit: { type: Sequelize.DECIMAL(15, 2) },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('category_sales_summary', ['store', 'category', 'report_date'])
    await queryInterface.addIndex('category_sales_summary', ['report_date'])

    await queryInterface.createTable('kasir_performance', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      store: { type: Sequelize.INTEGER, allowNull: false },
      cashier: { type: Sequelize.INTEGER, allowNull: false },
      report_date: { type: Sequelize.DATEONLY, allowNull: false },
      total_sales: { type: Sequelize.DECIMAL(15, 2) },
      transactions: { type: Sequelize.INTEGER },
      avg_transaction: { type: Sequelize.DECIMAL(15, 2) },
      items_sold: { type: Sequelize.INTEGER },
      accuracy_rate: { type: Sequelize.DECIMAL(5, 2) },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('kasir_performance', ['store', 'cashier', 'report_date'])
    await queryInterface.addIndex('kasir_performance', ['report_date'])
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('kasir_performance')
    await queryInterface.dropTable('category_sales_summary')
    await queryInterface.dropTable('product_sales_summary')
    await queryInterface.dropTable('sales_summary')
  }
}