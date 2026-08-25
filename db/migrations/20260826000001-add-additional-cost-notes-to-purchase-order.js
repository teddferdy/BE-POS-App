'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('purchase_order', 'additionalCostNotes', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Keterangan untuk biaya tambahan (misal: ongkir, admin bank)'
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('purchase_order', 'additionalCostNotes')
  }
}
