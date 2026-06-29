'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const hasSkuColumn = await queryInterface
        .describeTable('product')
        .then((table) => 'sku' in table)
        .catch(() => false)
      if (!hasSkuColumn) {
        await queryInterface.addColumn('product', 'sku', {
          type: Sequelize.STRING,
          unique: true
        })
      }
    } catch (err) {
      console.log('Column sku already exists or error checking:', err.message)
    }

    try {
      const hasBarcodeColumn = await queryInterface
        .describeTable('product')
        .then((table) => 'barcode' in table)
        .catch(() => false)
      if (!hasBarcodeColumn) {
        await queryInterface.addColumn('product', 'barcode', {
          type: Sequelize.STRING
        })
      }
    } catch (err) {
      console.log(
        'Column barcode already exists or error checking:',
        err.message
      )
    }

    try {
      const hasBrandColumn = await queryInterface
        .describeTable('product')
        .then((table) => 'brand' in table)
        .catch(() => false)
      if (!hasBrandColumn) {
        await queryInterface.addColumn('product', 'brand', {
          type: Sequelize.STRING
        })
      }
    } catch (err) {
      console.log('Column brand already exists or error checking:', err.message)
    }

    try {
      const hasPointColumn = await queryInterface
        .describeTable('product')
        .then((table) => 'point' in table)
        .catch(() => false)
      if (!hasPointColumn) {
        await queryInterface.addColumn('product', 'point', {
          type: Sequelize.INTEGER,
          defaultValue: 0
        })
      }
    } catch (err) {
      console.log('Column point already exists or error checking:', err.message)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('product', 'point')
    await queryInterface.removeColumn('product', 'brand')
    await queryInterface.removeColumn('product', 'barcode')
    await queryInterface.removeColumn('product', 'sku')
  }
}
