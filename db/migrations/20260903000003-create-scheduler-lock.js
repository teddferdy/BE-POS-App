module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Backs a cross-process lease so backup/expense/shift-swap schedulers
    // don't duplicate work if this API is ever scaled to 2+ instances — each
    // in-process setInterval tick claims this lock before doing anything,
    // and skips the tick if another instance already holds it.
    await queryInterface.createTable('scheduler_lock', {
      name: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      lockedUntil: {
        type: Sequelize.DATE,
        allowNull: true
      },
      lockedBy: {
        type: Sequelize.STRING,
        allowNull: true
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    })
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('scheduler_lock')
  }
}
