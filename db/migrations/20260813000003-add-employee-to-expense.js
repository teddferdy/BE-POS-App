'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('expense')

    if (!desc.employeeId) {
      await queryInterface.addColumn('expense', 'employeeId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      })
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('expense', 'employeeId')
  }
}
