'use strict'
module.exports = (sequelize, DataTypes) => {
  const inventory_valuation = sequelize.define(
    'inventory_valuation',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      product: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      valuation_date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      total_cost: {
        allowNull: false,
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      average_cost: {
        allowNull: false,
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      cogs_method: {
        allowNull: false,
        type: DataTypes.ENUM('FIFO', 'LIFO', 'WEIGHTED_AVERAGE', 'SPECIFIC_ID'),
        defaultValue: 'FIFO'
      },
      valuation_type: {
        allowNull: false,
        type: DataTypes.ENUM('periodic', 'perpetual'),
        defaultValue: 'perpetual'
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'inventory_valuation',
      tableName: 'inventory_valuation',
      indexes: [
        { fields: ['product', 'store'] },
        { fields: ['valuation_date'] },
        { fields: ['cogs_method'] }
      ]
    }
  )

  inventory_valuation.associate = (models) => {
    inventory_valuation.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    inventory_valuation.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return inventory_valuation
}
