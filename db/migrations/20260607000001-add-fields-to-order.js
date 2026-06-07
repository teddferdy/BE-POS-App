'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const table = await queryInterface.describeTable('order')
      if (!table.totalCovers) {
        await queryInterface.addColumn('order', 'totalCovers', {
          type: Sequelize.INTEGER,
          defaultValue: 0
        })
      }
    } catch (err) {
      console.log('Column totalCovers already exists or error checking:', err.message)
    }

    try {
      const table = await queryInterface.describeTable('order')
      if (!table.shiftId) {
        await queryInterface.addColumn('order', 'shiftId', {
          type: Sequelize.INTEGER,
          allowNull: true
        })
      }
    } catch (err) {
      console.log('Column shiftId already exists or error checking:', err.message)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('order', 'shiftId')
    await queryInterface.removeColumn('order', 'totalCovers')
  }
}
