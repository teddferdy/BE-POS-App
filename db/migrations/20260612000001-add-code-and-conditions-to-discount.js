'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('discount', 'code', {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true
    })

    await queryInterface.addColumn('discount', 'conditions', {
      type: Sequelize.JSONB,
      defaultValue: null
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('discount', 'conditions')
    await queryInterface.removeColumn('discount', 'code')
  }
}
