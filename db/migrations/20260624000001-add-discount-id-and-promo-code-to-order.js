'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const table = await queryInterface.describeTable('order')
      if (!table.discountId) {
        await queryInterface.addColumn('order', 'discountId', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'discount', key: 'id' },
          onDelete: 'SET NULL'
        })
      }
    } catch (err) {
      console.log('Column discountId error:', err.message)
    }

    try {
      const table = await queryInterface.describeTable('order')
      if (!table.promoCode) {
        await queryInterface.addColumn('order', 'promoCode', {
          type: Sequelize.STRING,
          allowNull: true
        })
      }
    } catch (err) {
      console.log('Column promoCode error:', err.message)
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('order', 'promoCode')
    await queryInterface.removeColumn('order', 'discountId')
  }
}
