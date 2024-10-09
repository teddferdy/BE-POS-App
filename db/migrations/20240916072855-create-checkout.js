'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('checkout', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        primaryKey: true,
        type: Sequelize.STRING
      },
      invoice: {
        primaryKey: true,
        allowNull: false,
        type: Sequelize.STRING
      },
      dateOrder: {
        allowNull: false,
        type: Sequelize.DATE
      },
      dateCheckout: {
        primaryKey: true,
        type: Sequelize.DATE
      },
      totalPrice: {
        type: Sequelize.INTEGER
      },
      cashierName: {
        type: Sequelize.STRING
      },
      customerName: {
        type: Sequelize.STRING
      },
      customerPhoneNumber: {
        type: Sequelize.STRING
      },
      totalQuantity: {
        type: Sequelize.BIGINT
      },
      typePayment: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      modifiedBy: {
        type: Sequelize.STRING
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      modifiedAt: {
        type: Sequelize.STRING
      },
      deletedAt: {
        type: Sequelize.STRING
      }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('checkout')
  }
}
