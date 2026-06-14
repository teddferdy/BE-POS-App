'use strict'
module.exports = (sequelize, DataTypes) => {
  const cashRegister = sequelize.define(
    'cashRegister',
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
      user: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      shift: {
        type: DataTypes.INTEGER
      },
      openingBalance: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      closingBalance: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalSales: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalExpenses: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalPayments: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        defaultValue: 'open'
      },
      openedAt: {
        type: DataTypes.DATE
      },
      closedAt: {
        type: DataTypes.DATE
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
      modelName: 'cashRegister',
      tableName: 'cash_register',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      deletedAt: 'deletedAt'
    }
  )

  cashRegister.associate = (models) => {
    cashRegister.belongsTo(models.user, {
      foreignKey: 'user',
      as: 'userData'
    })
    cashRegister.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return cashRegister
}
