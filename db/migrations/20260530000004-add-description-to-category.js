'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const desc = await queryInterface.describeTable('category')
      if (!desc.description) {
        await queryInterface.addColumn('category', 'description', {
          type: Sequelize.STRING,
          allowNull: true
        })
        console.log('Added description column to category')
      }
    } catch (e) {
      console.log(`Skipping: ${e.message}`)
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('category', 'description')
    } catch (e) {
      console.log(`Skipping: ${e.message}`)
    }
  }
}
