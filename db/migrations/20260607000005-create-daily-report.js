'use strict'
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('daily_report', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: { type: Sequelize.INTEGER },
      tanggal: { type: Sequelize.DATEONLY, allowNull: false },
      sesi: { type: Sequelize.STRING(20) },
      totalTransaksi: { type: Sequelize.INTEGER, defaultValue: 0 },
      totalPenjualanBersih: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      totalHpp: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      foodCostPersen: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      grossProfit: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      grossMarginPersen: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      totalBiayaOperasional: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      netProfit: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      netMarginPersen: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      totalCovers: { type: Sequelize.INTEGER, defaultValue: 0 },
      avgSpendingPerCover: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      totalItemVoid: { type: Sequelize.INTEGER, defaultValue: 0 },
      totalNilaiVoid: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      penjualanTunai: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      penjualanQris: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      penjualanTransfer: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      saldoKasAwal: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      saldoKasAkhirSistem: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      saldoKasAkhirFisik: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      selisihKas: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      statusFoodCost: { type: Sequelize.STRING(20) },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('daily_report')
  }
}
