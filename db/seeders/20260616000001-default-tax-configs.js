'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const existing = await queryInterface.sequelize.query(
      `SELECT name FROM tax_config WHERE name IN ('PPN 11%', 'PPh 23 2%', 'Non-Pajak')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingNames = existing.map((r) => r.name)

    const defaults = []
    if (!existingNames.includes('PPN 11%')) {
      defaults.push({
        name: 'PPN 11%',
        rate: 11,
        type: 'ppn',
        description: 'Pajak Pertambahan Nilai standar barang/jasa',
        status: 'active',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
    if (!existingNames.includes('PPh 23 2%')) {
      defaults.push({
        name: 'PPh 23 2%',
        rate: 2,
        type: 'other',
        description: 'Pajak Penghasilan Pasal 23 atas jasa',
        status: 'active',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
    if (!existingNames.includes('Non-Pajak')) {
      defaults.push({
        name: 'Non-Pajak',
        rate: 0,
        type: 'service_charge',
        description: 'Transaksi tidak dikenakan pajak',
        status: 'active',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    if (defaults.length > 0) {
      await queryInterface.bulkInsert('tax_config', defaults)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('tax_config', {
      name: { [Sequelize.Op.in]: ['PPN 11%', 'PPh 23 2%', 'Non-Pajak'] }
    })
  }
}
