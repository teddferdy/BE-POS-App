'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sub_category', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      parentCategory: {
        primaryKey: true,
        allowNull: false,
        type: Sequelize.STRING
      },
      nameSubCategory: {
        type: Sequelize.STRING
      },
      typeSubCategory: {
        type: Sequelize.TEXT
      },
      isMultiple: {
        type: Sequelize.BOOLEAN
      },
      createdBy: {
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
        type: Sequelize.STRING
      }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('sub_category')
  }
}
