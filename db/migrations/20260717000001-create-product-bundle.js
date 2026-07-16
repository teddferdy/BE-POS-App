'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_bundle', {
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
      sku: {
        type: Sequelize.STRING,
        unique: true
      },
      description: {
        type: Sequelize.TEXT
      },
      image: {
        type: Sequelize.STRING
      },
      bundlePrice: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      originalPrice: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      discountAmount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      discountPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      minQuantity: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      maxQuantity: {
        type: Sequelize.INTEGER
      },
      isAvailable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'active'
      },
      validFrom: {
        type: Sequelize.DATE
      },
      validUntil: {
        type: Sequelize.DATE
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

    await queryInterface.createTable('product_bundle_item', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      bundleId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'product_bundle', key: 'id' }
      },
      product: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'product', key: 'id' }
      },
      quantity: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      unitPrice: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isOptional: {
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

    await queryInterface.addIndex('product_bundle', ['store'], {
      using: 'GIN',
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('product_bundle', ['status'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('product_bundle', ['sku'], {
      unique: true,
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('product_bundle_item', ['bundleId'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('product_bundle_item', ['product'], {
      where: { deletedAt: null }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_bundle_item')
    await queryInterface.dropTable('product_bundle')
  }
}
