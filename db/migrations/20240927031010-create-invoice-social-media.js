'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_social_media', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        primaryKey: true,
        type: Sequelize.STRING
      },
      socialMediaList: {
        type: Sequelize.TEXT
      },
      status: {
        primaryKey: true,
        type: Sequelize.BOOLEAN
      },
      isActive: {
        primaryKey: true,
        type: Sequelize.BOOLEAN
      },
      store: {
        allowNull: false,
        type: Sequelize.INTEGER,
        primaryKey: true
      },
      createdBy: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      modifiedBy: {
        type: Sequelize.STRING
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
    await queryInterface.dropTable('invoice_social_media')
  }
}
