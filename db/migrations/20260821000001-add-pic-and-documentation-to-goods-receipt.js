module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('goods_receipt', 'pic', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
    await queryInterface.addColumn('goods_receipt', 'documentation', {
      type: Sequelize.STRING,
      allowNull: true
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('goods_receipt', 'pic')
    await queryInterface.removeColumn('goods_receipt', 'documentation')
  }
}
