'use strict'
module.exports = (sequelize, DataTypes) => {
  const stockOpname = sequelize.define(
    'stockOpname',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      opnameNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      date: {
        allowNull: false,
        type: DataTypes.DATE
      },
      auditDate: {
        type: DataTypes.DATEONLY
      },
      auditor: {
        type: DataTypes.STRING
      },
      totalAdjustment: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      status: {
        type: DataTypes.ENUM('draft', 'completed', 'cancelled'),
        defaultValue: 'draft'
      },
      notes: {
        type: DataTypes.TEXT
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
      modelName: 'stockOpname',
      tableName: 'stock_opname'
    }
  )

  stockOpname.associate = (models) => {
    stockOpname.hasMany(models.stockOpnameItem, {
      foreignKey: 'stockOpname',
      as: 'items'
    })
    stockOpname.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return stockOpname
}
