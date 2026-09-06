'use strict'
module.exports = (sequelize, DataTypes) => {
  const parkedCart = sequelize.define(
    'parkedCart',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      // Server-resolved only, never client-supplied — see
      // api/controller/parkedCart.js: req.body.store is never read.
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      tableId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Nullable historical/display reference only — no FK, no customer
      // domain lookup. Matches order.customerId's existing treatment
      // exactly (see db/models/order.js). Do not add a customer FK here.
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      customerName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      customerPhone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      discountId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      promoCode: {
        type: DataTypes.STRING,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      // The FE cart snapshot (order-list.js's `cart.order` array) plus
      // orderType/totalCovers context — a DISPLAY snapshot only. Never
      // treated as authoritative pricing/stock; resume hands it back to
      // the FE cart, and /order/create re-prices and re-validates stock
      // exactly as it does for any manually-built cart.
      cartPayload: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      displayTotalItems: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      displayTotalPrice: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('active', 'resumed', 'cancelled', 'expired'),
        allowNull: false,
        defaultValue: 'active'
      },
      // Canonical expiration is NOW() >= expiresAt, evaluated by the
      // database at decision time — the physical `status` column is
      // allowed to remain 'active' past this point indefinitely (lazy
      // expiration; no scheduler dependency). See computeEffectiveStatus
      // in api/controller/parkedCart.js.
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      resumedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      resumedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      cancelledBy: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      idempotencyKey: {
        type: DataTypes.STRING,
        allowNull: true
      }
    },
    {
      paranoid: false,
      freezeTableName: true,
      modelName: 'parkedCart',
      tableName: 'parked_cart'
    }
  )

  parkedCart.associate = (models) => {
    parkedCart.belongsTo(models.location, { foreignKey: 'store', as: 'storeData' })
    parkedCart.belongsTo(models.table, { foreignKey: 'tableId', as: 'table' })
    parkedCart.belongsTo(models.user, { foreignKey: 'createdBy', as: 'createdByData' })
    parkedCart.belongsTo(models.user, { foreignKey: 'resumedBy', as: 'resumedByData' })
    parkedCart.belongsTo(models.user, { foreignKey: 'cancelledBy', as: 'cancelledByData' })
  }

  return parkedCart
}
