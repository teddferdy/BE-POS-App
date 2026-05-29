'use strict'
module.exports = (sequelize, DataTypes) => {
  const stockOpnameItem = sequelize.define(
    'stockOpnameItem',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      stockOpname: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      kodeBarang: {
        type: DataTypes.STRING
      },
      namaBarang: {
        type: DataTypes.STRING
      },
      satuan: {
        type: DataTypes.STRING
      },
      lokasiId: {
        type: DataTypes.INTEGER
      },
      lokasi: {
        type: DataTypes.STRING
      },
      stokAwalJumlah: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      barangMasukJumlah: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      barangKeluarJumlah: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      stokAkhirJumlah: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      stokFisikJumlah: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      selisihJumlah: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      product: {
        type: DataTypes.INTEGER
      },
      ingredientName: {
        type: DataTypes.STRING
      },
      systemStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      actualStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      adjustment: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      notes: {
        type: DataTypes.TEXT
      },
      keterangan: {
        type: DataTypes.TEXT
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'stockOpnameItem',
      tableName: 'stock_opname_item'
    }
  )

  stockOpnameItem.associate = (models) => {
    stockOpnameItem.belongsTo(models.stockOpname, {
      foreignKey: 'stockOpname',
      as: 'parentOpname'
    })
  }

  return stockOpnameItem
}
