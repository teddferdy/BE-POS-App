'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('order', 'cashRegisterId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'cash_register', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    })
    await queryInterface.addIndex('order', {
      name: 'order_cashregisterid',
      fields: ['cashRegisterId']
    })
  },
  down: async (queryInterface) => {
    await queryInterface.removeIndex('order', 'order_cashregisterid')
    await queryInterface.removeColumn('order', 'cashRegisterId')
  }
}
