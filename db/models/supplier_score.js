'use strict'
module.exports = (sequelize, DataTypes) => {
  const SupplierScore = sequelize.define(
    'supplier_score',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.JSONB
      },
      supplierId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      period: {
        allowNull: false,
        type: DataTypes.ENUM('monthly', 'quarterly', 'yearly', 'all_time')
      },
      periodStart: {
        type: DataTypes.DATEONLY
      },
      periodEnd: {
        type: DataTypes.DATEONLY
      },
      totalOrders: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      completedOrders: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      cancelledOrders: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      onTimeDeliveries: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      lateDeliveries: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      onTimeRate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      totalReceivedQty: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      defectiveQty: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      defectRate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      totalPurchaseAmount: {
        type: DataTypes.BIGINT,
        defaultValue: 0
      },
      avgPricePerItem: {
        type: DataTypes.BIGINT,
        defaultValue: 0
      },
      priceCompetitivenessScore: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      overallScore: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      grade: {
        type: DataTypes.ENUM('A', 'B', 'C', 'D', 'F'),
        defaultValue: 'F'
      },
      notes: {
        type: DataTypes.TEXT
      },
      calculatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
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
      modelName: 'supplier_score',
      tableName: 'supplier_score'
    }
  )

  SupplierScore.associate = function (models) {
    SupplierScore.belongsTo(models.supplier, {
      foreignKey: 'supplierId',
      as: 'supplier'
    })
  }

  return SupplierScore
}
