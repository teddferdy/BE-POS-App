'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('expense')

    if (!desc.frequency) {
      await queryInterface.addColumn('expense', 'frequency', {
        type: Sequelize.STRING(20),
        allowNull: true
      })
    }

    if (!desc.parentId) {
      await queryInterface.addColumn('expense', 'parentId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'expense', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      })
    }

    if (!desc.nextDueDate) {
      await queryInterface.addColumn('expense', 'nextDueDate', {
        type: Sequelize.DATE,
        allowNull: true
      })
    }

    if (!desc.recurringEndDate) {
      await queryInterface.addColumn('expense', 'recurringEndDate', {
        type: Sequelize.DATE,
        allowNull: true
      })
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('expense', 'recurringEndDate')
    await queryInterface.removeColumn('expense', 'nextDueDate')
    await queryInterface.removeColumn('expense', 'parentId')
    await queryInterface.removeColumn('expense', 'frequency')
  }
}
