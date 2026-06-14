'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables()

    if (!tables.includes('accounts_receivable')) {
      await queryInterface.createTable('accounts_receivable', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        store: { type: Sequelize.INTEGER },
        orderId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        customerId: { type: Sequelize.INTEGER },
        customerName: { type: Sequelize.STRING },
        invoiceNo: { type: Sequelize.STRING },
        invoiceDate: { type: Sequelize.DATEONLY },
        dueDate: { type: Sequelize.DATEONLY },
        creditTerm: { type: Sequelize.STRING },
        totalAmount: { type: Sequelize.INTEGER, defaultValue: 0 },
        paidAmount: { type: Sequelize.INTEGER, defaultValue: 0 },
        outstandingAmount: { type: Sequelize.INTEGER, defaultValue: 0 },
        status: {
          type: Sequelize.STRING(20),
          defaultValue: 'UNPAID'
        },
        notes: { type: Sequelize.TEXT },
        createdBy: { type: Sequelize.INTEGER },
        modifiedBy: { type: Sequelize.INTEGER },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE },
        deletedAt: { type: Sequelize.DATE }
      })
    }

    if (!tables.includes('ar_payment')) {
      await queryInterface.createTable('ar_payment', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        arId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        amount: { type: Sequelize.INTEGER, defaultValue: 0 },
        paymentDate: { type: Sequelize.DATEONLY },
        paymentMethod: { type: Sequelize.STRING },
        reference: { type: Sequelize.STRING },
        notes: { type: Sequelize.TEXT },
        createdBy: { type: Sequelize.INTEGER },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE },
        deletedAt: { type: Sequelize.DATE }
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ar_payment')
    await queryInterface.dropTable('accounts_receivable')
  }
}
