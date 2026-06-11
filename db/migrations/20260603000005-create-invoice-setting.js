'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_setting', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true
      },
      logoImage: {
        type: Sequelize.STRING,
        allowNull: true
      },
      footerText: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      socialMediaList: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      showLogo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      showStoreName: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      showAddress: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      showFooter: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdBy: {
        type: Sequelize.STRING,
        allowNull: true
      },
      modifiedBy: {
        type: Sequelize.STRING,
        allowNull: true
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
        type: Sequelize.DATE,
        allowNull: true
      }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('invoice_setting')
  }
}
