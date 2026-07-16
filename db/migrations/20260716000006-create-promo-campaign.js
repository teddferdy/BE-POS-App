'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promo_campaign', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.JSONB
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.TEXT
      },
      code: {
        type: Sequelize.STRING(50)
      },
      type: {
        allowNull: false,
        type: Sequelize.ENUM('happy_hour', 'birthday', 'buy_x_get_y', 'spend_get', 'manual', 'automatic')
      },
      discountType: {
        type: Sequelize.ENUM('percentage', 'fixed', 'free_item', 'buy_x_get_y'),
        defaultValue: 'percentage'
      },
      discountValue: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      maxDiscount: {
        type: Sequelize.INTEGER
      },
      minPurchase: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      startDate: {
        allowNull: false,
        type: Sequelize.DATE
      },
      endDate: {
        allowNull: false,
        type: Sequelize.DATE
      },
      startTime: {
        type: Sequelize.TIME
      },
      endTime: {
        type: Sequelize.TIME
      },
      daysOfWeek: {
        type: Sequelize.JSONB
      },
      applicableTo: {
        type: Sequelize.ENUM('all', 'specific_products', 'specific_categories', 'specific_members'),
        defaultValue: 'all'
      },
      applicableIds: {
        type: Sequelize.JSONB
      },
      maxUsageTotal: {
        type: Sequelize.INTEGER
      },
      maxUsagePerMember: {
        type: Sequelize.INTEGER
      },
      currentUsage: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      priority: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isCombinable: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'paused', 'expired', 'cancelled'),
        defaultValue: 'draft'
      },
      autoActivate: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
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

    await queryInterface.addIndex('promo_campaign', ['store'], {
      using: 'GIN',
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('promo_campaign', ['status'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('promo_campaign', ['type'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('promo_campaign', ['code'], {
      unique: true,
      where: { deletedAt: null }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('promo_campaign')
  }
}
