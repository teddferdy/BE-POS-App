'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('user', 'fullName', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.addColumn('user', 'department', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.addColumn('user', 'employmentType', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.addColumn('user', 'startDate', {
      type: Sequelize.DATEONLY,
      allowNull: true
    })

    await queryInterface.addColumn('user', 'dateOfBirth', {
      type: Sequelize.DATEONLY,
      allowNull: true
    })

    await queryInterface.addColumn('user', 'placeOfBirth', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.removeColumn('user', 'placeDateOfBirth')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('user', 'placeDateOfBirth', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.removeColumn('user', 'placeOfBirth')
    await queryInterface.removeColumn('user', 'dateOfBirth')
    await queryInterface.removeColumn('user', 'startDate')
    await queryInterface.removeColumn('user', 'employmentType')
    await queryInterface.removeColumn('user', 'department')
    await queryInterface.removeColumn('user', 'fullName')
  }
}
