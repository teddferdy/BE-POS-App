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
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      isAvailable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      point: {
        type: DataTypes.INTEGER,
        defaultValue: 0
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
      currencyId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'currency', key: 'id' }
      },
      currencyCode: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      },
      tipeProduk: {
        type: DataTypes.STRING(20),
        defaultValue: 'menu'
      },
      hppPerPorsi: {
        type: DataTypes.DECIMAL(15,2),
        defaultValue: 0
      },
      foodCostPersen: {
        type: DataTypes.DECIMAL(5,2),
        defaultValue: 0
      },
      marginPersen: {
        type: DataTypes.DECIMAL(5,2),
        defaultValue: 0
      },
      isAvailableHariIni: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      composition: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
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
    product.hasMany(models.stock_transfer_item, {
      foreignKey: 'product',
      as: 'stockTransferItems'
    })
    product.hasMany(models.purchase_return_item, {
      foreignKey: 'product',
      as: 'purchaseReturnItems'
    })
    product.hasMany(models.sales_return_item, {
      foreignKey: 'product',
      as: 'salesReturnItems'
    })
    product.hasMany(models.product_batch, {
      foreignKey: 'product',
      as: 'batches'
    })
    product.hasMany(models.product_store_price, {
      foreignKey: 'product',
      as: 'storePrices'
    })
    product.hasMany(models.bom_header, {
      foreignKey: 'productId',
      as: 'bomHeaders'
    })
  }

  return product
}
