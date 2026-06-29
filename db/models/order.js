'use strict'
module.exports = (sequelize, DataTypes) => {
  const order = sequelize.define(
    'order',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      orderNumber: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true
      },
      store: {
        type: DataTypes.INTEGER
      },
      tableId: {
        type: DataTypes.INTEGER
      },
      customerId: {
        type: DataTypes.INTEGER
      },
      customerName: {
        type: DataTypes.STRING
      },
      customerPhone: {
        type: DataTypes.STRING
      },
      discountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'discount', key: 'id' }
      },
      promoCode: {
        type: DataTypes.STRING,
        allowNull: true
      },
      cashierId: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      cashierName: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.ENUM(
          'pending',
          'confirmed',
          'preparing',
          'ready',
          'served',
          'paid',
          'cancelled',
          'void'
        ),
        defaultValue: 'pending'
      },
      subTotal: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      discountType: {
        type: DataTypes.ENUM('none', 'percent', 'nominal'),
        defaultValue: 'none'
      },
      discountValue: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      discountAmount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      taxRate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      taxAmount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      serviceChargeRate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      serviceChargeAmount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalQuantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalPrice: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      paymentMethod: {
        type: DataTypes.STRING
      },
      paymentStatus: {
        type: DataTypes.ENUM('unpaid', 'partial', 'paid'),
        defaultValue: 'unpaid'
      },
      notes: {
        type: DataTypes.TEXT
      },
      source: {
        type: DataTypes.ENUM('pos', 'online', 'qr', 'waiter'),
        defaultValue: 'pos'
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
      exchangeRate: {
        type: DataTypes.DECIMAL(18, 6),
        allowNull: true,
        defaultValue: 1.0
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      },
      totalCovers: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      shiftId: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'order',
      tableName: 'order'
    }
  )

  order.associate = (models) => {
    order.hasMany(models.order_item, { foreignKey: 'order', as: 'items' })
    order.hasMany(models.order_status, { foreignKey: 'order', as: 'statusHistory' })
    order.belongsTo(models.table, { foreignKey: 'tableId', as: 'table' })
    order.hasMany(models.transaction, { foreignKey: 'order', as: 'transactions' })
    order.belongsTo(models.location, { foreignKey: 'store', as: 'storeData' })
  }

  return order
}
