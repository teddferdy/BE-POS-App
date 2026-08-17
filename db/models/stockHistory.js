'use strict'
module.exports = (sequelize, DataTypes) => {
  const stock_history = sequelize.define(
    'stock_history',
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
      product: {
        type: DataTypes.INTEGER
      },
      ingredient: {
        type: DataTypes.INTEGER
      },
      ingredientName: {
        type: DataTypes.STRING
      },
      referenceType: {
        allowNull: false,
        type: DataTypes.ENUM(
          'purchase',
          'sale',
          'adjustment',
          'opname',
          'purchase_return',
          'sale_return',
          'transfer',
          'production',
          'sale_return_reversal',
          'sale_reversal',
          'production_reversal'
        )
      },
      referenceId: {
        type: DataTypes.INTEGER
      },
      quantityBefore: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      quantityChange: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      quantityAfter: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      notes: {
        type: DataTypes.TEXT
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'stock_history',
      tableName: 'stock_history'
    }
  )

  stock_history.associate = (models) => {
    stock_history.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    stock_history.belongsTo(models.ingredient, {
      foreignKey: 'ingredient',
      as: 'ingredientData'
    })
  }

  return stock_history
}
