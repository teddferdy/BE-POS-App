module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('purchase_order', 'pic', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('purchase_order', 'pic')
  }
}
