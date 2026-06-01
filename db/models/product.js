'use strict'
module.exports = (sequelize, DataTypes) => {
  const product = sequelize.define(
    'product',
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
      nameProduct: {
        allowNull: false,
        type: DataTypes.STRING
      },
      sku: {
        type: DataTypes.STRING,
        unique: true
      },
      image: {
        type: DataTypes.STRING
      },
      barcode: {
        type: DataTypes.STRING
      },
      brand: {
        type: DataTypes.STRING
      },

      category: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      description: {
        type: DataTypes.TEXT
      },
      price: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      costPrice: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      isOption: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      options: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      hasModifiers: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      modifiers: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      minStock: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      isAvailable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      point: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      preparationTime: {
        type: DataTypes.INTEGER,
        defaultValue: 15
      },
      supplier: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      tax: {
        type: DataTypes.JSONB,
        defaultValue: null
      },
      priceTiers: {
        type: DataTypes.JSONB,
        defaultValue: []
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
      modelName: 'product',
      tableName: 'product'
    }
  )

  product.associate = (models) => {
    product.belongsTo(models.category, {
      foreignKey: 'category',
      as: 'categoryData'
    })
    product.hasMany(models.stock_history, {
      foreignKey: 'product',
      as: 'stockHistories'
    })
  }

  return product
}
