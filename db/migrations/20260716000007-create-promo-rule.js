'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promo_rule', {
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
      ruleType: {
        allowNull: false,
        type: Sequelize.ENUM('time', 'birthday', 'buy_x_get_y', 'spend_threshold', 'member_tier', 'first_purchase', 'custom')
      },
      condition: {
        allowNull: false,
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

    await queryInterface.addIndex('promo_rule', ['campaignId'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('promo_rule', ['ruleType'], {
      where: { deletedAt: null }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('promo_rule')
  }
}
