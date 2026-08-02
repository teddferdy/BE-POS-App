'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'shift',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      startTime: {
        allowNull: false,
        type: DataTypes.TIME
      },
      endTime: {
        allowNull: false,
        type: DataTypes.TIME
      },
      tipe_shift: {
        type: DataTypes.STRING(20),
        defaultValue: ''
      },
      tanggal_mulai: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      tanggal_selesai: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      karyawan: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'shift',
      tableName: 'shift'
    }
  )
}
