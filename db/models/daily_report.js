'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'daily_report',
    {
      id:         { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      store:      { type: DataTypes.INTEGER },
      tanggal:    { type: DataTypes.DATEONLY, allowNull: false },
      sesi:       { type: DataTypes.STRING(20) },
      totalTransaksi:        { type: DataTypes.INTEGER, defaultValue: 0 },
      totalPenjualanBersih:  { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      totalHpp:              { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      foodCostPersen:        { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
      grossProfit:           { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      grossMarginPersen:     { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
      totalBiayaOperasional: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      netProfit:             { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      netMarginPersen:       { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
      totalCovers:           { type: DataTypes.INTEGER, defaultValue: 0 },
      avgSpendingPerCover:   { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      totalItemVoid:         { type: DataTypes.INTEGER, defaultValue: 0 },
      totalNilaiVoid:        { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      penjualanTunai:        { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      penjualanQris:         { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      penjualanTransfer:     { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      saldoKasAwal:          { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      saldoKasAkhirSistem:   { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      saldoKasAkhirFisik:    { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      selisihKas:            { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
      statusFoodCost:        { type: DataTypes.STRING(20) }
    },
    { paranoid: true, freezeTableName: true, tableName: 'daily_report' }
  )
}
