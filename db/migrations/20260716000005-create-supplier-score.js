'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('supplier_score', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.JSONB
      },
      supplierId: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      period: {
        allowNull: false,
        type: Sequelize.ENUM('monthly', 'quarterly', 'yearly', 'all_time')
      },
      periodStart: {
        type: Sequelize.DATEONLY
      },
      periodEnd: {
        type: Sequelize.DATEONLY
      },
      totalOrders: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      completedOrders: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      cancelledOrders: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      onTimeDeliveries: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      lateDeliveries: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      onTimeRate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      totalReceivedQty: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      defectiveQty: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      defectRate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      totalPurchaseAmount: {
        type: Sequelize.BIGINT,
        defaultValue: 0
      },
      avgPricePerItem: {
        type: Sequelize.BIGINT,
        defaultValue: 0
      },
      priceCompetitivenessScore: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      overallScore: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      grade: {
        type: Sequelize.ENUM('A', 'B', 'C', 'D', 'F'),
        defaultValue: 'F'
      },
      notes: {
        type: Sequelize.TEXT
      },
      calculatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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

    await queryInterface.addIndex('supplier_score', ['store'], {
      using: 'GIN',
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('supplier_score', ['supplierId'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('supplier_score', ['period'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('supplier_score', ['overallScore'], {
      where: { deletedAt: null }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('supplier_score')
  }
}
