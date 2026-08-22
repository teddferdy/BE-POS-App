module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('goods_receipt', 'suratJalan', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('goods_receipt', 'taxInvoiceNo', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('goods_receipt', 'shippingCost', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    })
    // documentation now stores a JSON array of photo URLs
    await queryInterface.changeColumn('goods_receipt', 'documentation', {
      type: Sequelize.TEXT,
      allowNull: true
    })
    await queryInterface.addColumn('goods_receipt_item', 'batchNumber', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('goods_receipt_item', 'expiryDate', {
      type: Sequelize.DATEONLY,
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('goods_receipt', 'suratJalan')
    await queryInterface.removeColumn('goods_receipt', 'taxInvoiceNo')
    await queryInterface.removeColumn('goods_receipt', 'shippingCost')
    await queryInterface.changeColumn('goods_receipt', 'documentation', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.removeColumn('goods_receipt_item', 'batchNumber')
    await queryInterface.removeColumn('goods_receipt_item', 'expiryDate')
  }
}
