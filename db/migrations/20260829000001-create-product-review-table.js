'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'product_review'",
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (tables.length === 0) {
      await queryInterface.createTable('product_review', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        productId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        store: {
          type: Sequelize.INTEGER
        },
        userName: {
          allowNull: false,
          type: Sequelize.STRING(100)
        },
        rating: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        comment: {
          type: Sequelize.TEXT
        },
        orderId: {
          type: Sequelize.INTEGER
        },
        status: {
          type: Sequelize.STRING(20),
          defaultValue: 'published'
        },
        createdBy: {
          type: Sequelize.INTEGER
        },
        modifiedBy: {
          type: Sequelize.INTEGER
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        deletedAt: {
          type: Sequelize.DATE
        }
      })

      await queryInterface.addIndex('product_review', ['productId', 'store'])
      await queryInterface.addIndex('product_review', ['store'])
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('product_review')
  }
}