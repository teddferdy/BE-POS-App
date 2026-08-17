'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'station_dapur',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING(20), defaultValue: 'active' }
    },
    { paranoid: true, freezeTableName: true, tableName: 'station_dapur' }
  )
}
