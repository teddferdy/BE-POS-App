'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promo_reward', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      campaignId: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      rewardType: {
        allowNull: false,
        type: Sequelize.ENUM('discount_percentage', 'discount_fixed', 'free_item', 'buy_x_get_y', 'points_multiplier', 'cashback')
      },
      rewardValue: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      maxRewardValue: {
        type: Sequelize.INTEGER
      },
      productId: {
        type: Sequelize.INTEGER
      },
      productIds: {
        type: Sequelize.JSONB
      },
      quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      condition: {
        type: Sequelize.JSONB
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      priority: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdBy: {
        type: Sequelize.INTEGER
      },
      modifiedBy: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deletedAt: {
        type: Sequelize.DATE
      }
    })

    await queryInterface.addIndex('promo_reward', ['campaignId'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('promo_reward', ['rewardType'], {
      where: { deletedAt: null }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('promo_reward')
  }
}
