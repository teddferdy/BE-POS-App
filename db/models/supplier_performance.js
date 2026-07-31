'use strict'
module.exports = (sequelize, DataTypes) => {
  const supplier_performance = sequelize.define(
    'supplier_performance',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      supplier: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      month: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      total_orders: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      on_time_deliveries: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      late_deliveries: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      damaged_items: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      correct_items: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      avg_lead_time_days: {
        allowNull: true,
        type: DataTypes.DECIMAL(5, 2)
      },
      total_value: {
        allowNull: false,
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      total_quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      score: {
        allowNull: true,
        type: DataTypes.DECIMAL(5, 2)
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'supplier_performance',
      tableName: 'supplier_performance',
      indexes: [
        { fields: ['supplier'] },
        { fields: ['month'] },
        { fields: ['supplier', 'month'], unique: true }
      ]
    }
  )

  supplier_performance.associate = (models) => {
    supplier_performance.belongsTo(models.supplier, {
      foreignKey: 'supplier',
      as: 'supplierData'
    })
  }

  return supplier_performance
}