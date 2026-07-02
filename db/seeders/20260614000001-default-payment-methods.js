'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const existing = await queryInterface.sequelize.query(
      `SELECT name FROM type_payment WHERE store IS NULL AND name IN ('Cash', 'QRIS')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingNames = existing.map((r) => r.name)

    const defaults = []
    if (!existingNames.includes('Cash')) {
      defaults.push({
        name: 'Cash',
        type: 'cash',
        store: null,
        icon: null,
        status: 'active',
        isSystem: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
    if (!existingNames.includes('QRIS')) {
      defaults.push({
        name: 'QRIS',
        type: 'e-wallet',
        store: null,
        icon: null,
        status: 'active',
        isSystem: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    if (defaults.length > 0) {
      await queryInterface.bulkInsert('type_payment', defaults)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('type_payment', {
      name: { [Sequelize.Op.in]: ['Cash', 'QRIS'] },
      store: null
    })
  }
}
