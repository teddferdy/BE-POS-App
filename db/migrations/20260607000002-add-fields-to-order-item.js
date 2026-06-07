'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const table = await queryInterface.describeTable('order_item')
      if (!table.waktuSiap) {
        await queryInterface.addColumn('order_item', 'waktuSiap', {
          type: Sequelize.DATE,
          allowNull: true
        })
      }
    } catch (err) {
      console.log('Column waktuSiap already exists or error checking:', err.message)
    }

    try {
      const table = await queryInterface.describeTable('order_item')
      if (!table.urutanSaji) {
        await queryInterface.addColumn('order_item', 'urutanSaji', {
          type: Sequelize.INTEGER,
          defaultValue: 0
        })
      }
    } catch (err) {
      console.log('Column urutanSaji already exists or error checking:', err.message)
    }

    try {
      const table = await queryInterface.describeTable('order_item')
      if (!table.hppSnapshot) {
        await queryInterface.addColumn('order_item', 'hppSnapshot', {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true
        })
      }
    } catch (err) {
      console.log('Column hppSnapshot already exists or error checking:', err.message)
    }

    try {
      const table = await queryInterface.describeTable('order_item')
      if (!table.stationDapur) {
        await queryInterface.addColumn('order_item', 'stationDapur', {
          type: Sequelize.INTEGER,
          allowNull: true
        })
      }
    } catch (err) {
      console.log('Column stationDapur already exists or error checking:', err.message)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('order_item', 'stationDapur')
    await queryInterface.removeColumn('order_item', 'hppSnapshot')
    await queryInterface.removeColumn('order_item', 'urutanSaji')
    await queryInterface.removeColumn('order_item', 'waktuSiap')
  }
}
