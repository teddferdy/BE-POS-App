'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('user')

    if (!table.fullName) {
      await queryInterface.addColumn('user', 'fullName', { type: Sequelize.STRING, allowNull: true })
    }
    if (!table.department) {
      await queryInterface.addColumn('user', 'department', { type: Sequelize.STRING, allowNull: true })
    }
    if (!table.employmentType) {
      await queryInterface.addColumn('user', 'employmentType', { type: Sequelize.STRING, allowNull: true })
    }
    if (!table.startDate) {
      await queryInterface.addColumn('user', 'startDate', { type: Sequelize.DATEONLY, allowNull: true })
    }
    if (!table.dateOfBirth) {
      await queryInterface.addColumn('user', 'dateOfBirth', { type: Sequelize.DATEONLY, allowNull: true })
    }
    if (!table.placeOfBirth) {
      await queryInterface.addColumn('user', 'placeOfBirth', { type: Sequelize.STRING, allowNull: true })
    }
    if (table.placeDateOfBirth) {
      await queryInterface.removeColumn('user', 'placeDateOfBirth')
    }
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
