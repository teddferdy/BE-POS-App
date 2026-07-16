'use strict'
module.exports = (sequelize, DataTypes) => {
  const PromoReward = sequelize.define(
    'promo_reward',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      campaignId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      rewardType: {
        allowNull: false,
        type: DataTypes.ENUM('discount_percentage', 'discount_fixed', 'free_item', 'buy_x_get_y', 'points_multiplier', 'cashback')
      },
      rewardValue: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      maxRewardValue: {
        type: DataTypes.INTEGER
      },
      productId: {
        type: DataTypes.INTEGER
      },
      productIds: {
        type: DataTypes.JSONB
      },
      quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      condition: {
        type: DataTypes.JSONB
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 0
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
      modelName: 'promo_reward',
      tableName: 'promo_reward'
    }
  )

  PromoReward.associate = function (models) {
    PromoReward.belongsTo(models.promo_campaign, { foreignKey: 'campaignId', as: 'campaign' })
    PromoReward.belongsTo(models.product, { foreignKey: 'productId', as: 'product' })
  }

  return PromoReward
}
