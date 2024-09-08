'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userType: {
        type: Sequelize.STRING
      },
      userName: {
        allowNull: false,
        type: Sequelize.STRING,
        primaryKey: true
      },
      password: {
        allowNull: false,
        type: Sequelize.STRING
      },
      email: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      address: {
        type: Sequelize.STRING
      },
      gender: {
        type: Sequelize.STRING
      },
      phoneNumber: {
        type: Sequelize.STRING
      },
      employeeID: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      statusEmployee: {
        type: Sequelize.BOOLEAN
      },
      statusActive: {
        type: Sequelize.BOOLEAN
      },
      placeDateOfBirth: {
        type: Sequelize.STRING
      },
      location: {
        allowNull: false,
        type: Sequelize.STRING
      },
      shiftName: {
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
      modifiedAt: {
        type: Sequelize.STRING
      },
      deletedAt: {
        type: Sequelize.STRING
      }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('user')
  }
}
