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
      // Net cash retained in the drawer from cash sales (cashReceived minus
      // changeGiven), NOT gross customer tender. This is the figure the
      // expectedCash formula actually uses. `totalSales` above keeps its
      // separate, pre-existing meaning (gross paid-order sales across every
      // payment method) — the two must never be conflated. Do not compute
      // this by summing raw transaction.cashReceived alone.
      cashSalesReceived: {
        type: DataTypes.INTEGER,
        allowNull: true
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
      variance: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      varianceApprovalStatus: {
        type: DataTypes.ENUM(
          'auto_approved',
          'pending_approval',
          'approved',
          'rejected'
        ),
        allowNull: true
      },
      approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true
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
    cashRegister.belongsTo(models.user, {
      foreignKey: 'approvedBy',
      as: 'approvedByData'
    })
  }

  return cashRegister
}
