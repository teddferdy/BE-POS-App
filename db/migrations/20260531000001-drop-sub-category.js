'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const hasColumn = await queryInterface
        .describeTable('product')
        .then((table) => 'subCategory' in table)
        .catch(() => false)
      if (hasColumn) {
        await queryInterface.removeColumn('product', 'subCategory')
      }
    } catch (err) {
      console.log('Column subCategory already removed or does not exist')
    }

    try {
      await queryInterface.dropTable('sub_category')
    } catch (err) {
      console.log('Table sub_category already dropped or does not exist')
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sub_category', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.INTEGER
      },
      category: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING
      },
      options: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdBy: {
        type: Sequelize.STRING
      },
      modifiedBy: {
        type: Sequelize.STRING
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
    await queryInterface.addColumn('product', 'subCategory', {
      type: Sequelize.INTEGER
    })
  }
}
