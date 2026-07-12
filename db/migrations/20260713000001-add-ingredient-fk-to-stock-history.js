'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('stock_history', 'ingredient', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'ingredient',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    })

    await queryInterface.addIndex('stock_history', ['ingredient'])
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('stock_history', ['ingredient'])
    await queryInterface.removeColumn('stock_history', 'ingredient')
  }
}
