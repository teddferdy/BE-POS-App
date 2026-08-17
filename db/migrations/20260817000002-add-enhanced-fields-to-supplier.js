'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('supplier')

    const addCol = async (name, type) => {
      if (!table[name]) {
        await queryInterface.addColumn('supplier', name, type)
      }
    }

    // Payment terms
    await addCol('paymentType', {
      type: Sequelize.STRING(10),
      defaultValue: 'cbd'
    })
    await addCol('tempoDays', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })

    // Category
    await addCol('categoryId', {
      type: Sequelize.INTEGER
    })

    // Additional contact fields
    await addCol('mobile', { type: Sequelize.STRING })
    await addCol('whatsapp', { type: Sequelize.STRING })
    await addCol('fax', { type: Sequelize.STRING })
    await addCol('website', { type: Sequelize.STRING })

    // Tax fields
    await addCol('taxInclude', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })
    await addCol('taxType', { type: Sequelize.STRING(20) })
    await addCol('taxNumber', { type: Sequelize.STRING })
    await addCol('taxName', { type: Sequelize.STRING })
    await addCol('nitku', { type: Sequelize.STRING })
    await addCol('taxTransactionType', { type: Sequelize.STRING(20) })

    // Purchase defaults
    await addCol('defaultDiscount', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0
    })
    await addCol('defaultDescription', { type: Sequelize.TEXT })
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('supplier')
    const removeCol = async (name) => {
      if (table[name]) {
        await queryInterface.removeColumn('supplier', name)
      }
    }

    await removeCol('paymentType')
    await removeCol('tempoDays')
    await removeCol('categoryId')
    await removeCol('mobile')
    await removeCol('whatsapp')
    await removeCol('fax')
    await removeCol('website')
    await removeCol('taxInclude')
    await removeCol('taxType')
    await removeCol('taxNumber')
    await removeCol('taxName')
    await removeCol('nitku')
    await removeCol('taxTransactionType')
    await removeCol('defaultDiscount')
    await removeCol('defaultDescription')
  }
}
