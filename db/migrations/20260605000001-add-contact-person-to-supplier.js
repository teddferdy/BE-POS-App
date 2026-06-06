module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('supplier', 'contactPerson', {
      type: Sequelize.STRING,
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('supplier', 'contactPerson')
  }
}
