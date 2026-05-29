'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const opnameTable = await queryInterface.describeTable('stock_opname')
    const itemTable = await queryInterface.describeTable('stock_opname_item')

    const opnameColumns = [
      { name: 'auditDate', type: Sequelize.DATEONLY, allowNull: true },
      { name: 'auditor', type: Sequelize.STRING, allowNull: true }
    ]

    for (const col of opnameColumns) {
      if (!opnameTable[col.name]) {
        await queryInterface.addColumn('stock_opname', col.name, {
          type: col.type,
          allowNull: col.allowNull
        })
      }
    }

    const itemColumns = [
      { name: 'kodeBarang', type: Sequelize.STRING, allowNull: true },
      { name: 'namaBarang', type: Sequelize.STRING, allowNull: true },
      { name: 'satuan', type: Sequelize.STRING, allowNull: true },
      { name: 'lokasiId', type: Sequelize.INTEGER, allowNull: true },
      { name: 'lokasi', type: Sequelize.STRING, allowNull: true },
      { name: 'stokAwalJumlah', type: Sequelize.INTEGER, defaultValue: 0 },
      { name: 'barangMasukJumlah', type: Sequelize.INTEGER, defaultValue: 0 },
      { name: 'barangKeluarJumlah', type: Sequelize.INTEGER, defaultValue: 0 },
      { name: 'stokAkhirJumlah', type: Sequelize.INTEGER, defaultValue: 0 },
      { name: 'stokFisikJumlah', type: Sequelize.INTEGER, defaultValue: 0 },
      { name: 'selisihJumlah', type: Sequelize.INTEGER, defaultValue: 0 },
      { name: 'keterangan', type: Sequelize.TEXT, allowNull: true }
    ]

    for (const col of itemColumns) {
      if (!itemTable[col.name]) {
        await queryInterface.addColumn('stock_opname_item', col.name, {
          type: col.type,
          defaultValue: col.defaultValue,
          allowNull: col.allowNull !== false
        })
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const opnameColumns = ['auditDate', 'auditor']
    const itemColumns = [
      'kodeBarang',
      'namaBarang',
      'satuan',
      'lokasiId',
      'lokasi',
      'stokAwalJumlah',
      'barangMasukJumlah',
      'barangKeluarJumlah',
      'stokAkhirJumlah',
      'stokFisikJumlah',
      'selisihJumlah',
      'keterangan'
    ]

    for (const col of opnameColumns) {
      await queryInterface.removeColumn('stock_opname', col)
    }

    for (const col of itemColumns) {
      await queryInterface.removeColumn('stock_opname_item', col)
    }
  }
}
