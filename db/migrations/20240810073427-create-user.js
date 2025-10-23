'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      image: {
        type: Sequelize.STRING,
      },
      userType: {
        type: Sequelize.STRING,
      },
      userName: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true, // ✅ unique instead of primaryKey
      },
      password: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      email: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true, // ✅ unique instead of primaryKey
      },
      address: {
        type: Sequelize.STRING,
      },
      gender: {
        type: Sequelize.STRING,
      },
      phoneNumber: {
        type: Sequelize.STRING,
      },
      employeeID: {
        type: Sequelize.STRING,
        unique: true, // ✅ unique instead of primaryKey
      },
      statusEmployee: {
        type: Sequelize.BOOLEAN,
      },
      statusActive: {
        type: Sequelize.BOOLEAN,
      },
      placeDateOfBirth: {
        type: Sequelize.STRING,
      },
      store: {
        type: Sequelize.INTEGER,
      },
      shift: {
        type: Sequelize.INTEGER,
      },
      position: {
        type: Sequelize.INTEGER,
      },
      accessMenu: {
        type: Sequelize.TEXT,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      modifiedAt: {
        type: Sequelize.STRING,
      },
      deletedAt: {
        type: Sequelize.STRING,
      },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user')
  },
}
