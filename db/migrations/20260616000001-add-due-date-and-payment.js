'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('purchase_order', 'dueDate', {
      type: Sequelize.DATEONLY,
      allowNull: true
    })

    await queryInterface.createTable('purchase_payment', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: { type: Sequelize.INTEGER },
      purchaseOrder: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'purchase_order', key: 'id' }
      },
      supplier: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'supplier', key: 'id' }
      },
      paymentDate: { type: Sequelize.DATEONLY },
      amount: { type: Sequelize.INTEGER, defaultValue: 0 },
      paymentMethod: { type: Sequelize.STRING },
      reference: { type: Sequelize.STRING },
      notes: { type: Sequelize.TEXT },
      createdBy: { type: Sequelize.INTEGER },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
      deletedAt: { type: Sequelize.DATE }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('purchase_payment')
    await queryInterface.removeColumn('purchase_order', 'dueDate')
  }
}
