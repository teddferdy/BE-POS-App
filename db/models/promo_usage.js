'use strict'
module.exports = (sequelize, DataTypes) => {
  const PromoUsage = sequelize.define(
    'promo_usage',
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
      campaignId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      orderId: {
        type: DataTypes.INTEGER
      },
      memberId: {
        type: DataTypes.INTEGER
      },
      discountApplied: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      freeItemsGiven: {
        type: DataTypes.JSONB
      },
      pointsMultiplier: {
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      cashbackAmount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      appliedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'promo_usage',
      tableName: 'promo_usage'
    }
  )

  PromoUsage.associate = function (models) {
    PromoUsage.belongsTo(models.promo_campaign, {
      foreignKey: 'campaignId',
      as: 'campaign'
    })
    PromoUsage.belongsTo(models.order, { foreignKey: 'orderId', as: 'order' })
    PromoUsage.belongsTo(models.member, {
      foreignKey: 'memberId',
      as: 'member'
    })
  }

  return PromoUsage
}
