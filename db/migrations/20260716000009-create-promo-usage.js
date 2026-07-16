'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promo_usage', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.JSONB
      },
      campaignId: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      orderId: {
        type: Sequelize.INTEGER
      },
      memberId: {
        type: Sequelize.INTEGER
      },
      discountApplied: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      freeItemsGiven: {
        type: Sequelize.JSONB
      },
      pointsMultiplier: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      cashbackAmount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      appliedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      createdBy: {
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

    await queryInterface.addIndex('promo_usage', ['store'], {
      using: 'GIN',
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('promo_usage', ['campaignId'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('promo_usage', ['orderId'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('promo_usage', ['memberId'], {
      where: { deletedAt: null }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('promo_usage')
  }
}
