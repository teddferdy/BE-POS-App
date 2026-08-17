'use strict'
module.exports = (sequelize, DataTypes) => {
  const PromoRule = sequelize.define(
    'promo_rule',
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
      ruleType: {
        allowNull: false,
        type: DataTypes.ENUM(
          'time',
          'birthday',
          'buy_x_get_y',
          'spend_threshold',
          'member_tier',
          'first_purchase',
          'custom'
        )
      },
      condition: {
        allowNull: false,
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
      modelName: 'promo_rule',
      tableName: 'promo_rule'
    }
  )

  PromoRule.associate = function (models) {
    PromoRule.belongsTo(models.promo_campaign, {
      foreignKey: 'campaignId',
      as: 'campaign'
    })
  }

  return PromoRule
}
