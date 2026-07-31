'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('role')
    if (!tableDescription.isSystem) {
      await queryInterface.addColumn('role', 'isSystem', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      })
    }

    await queryInterface.sequelize.query(
      `UPDATE role SET "isSystem" = true WHERE "createdBy" IS NULL`
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('role', 'isSystem')
  }
}
