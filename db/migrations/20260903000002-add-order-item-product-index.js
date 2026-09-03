module.exports = {
  up: async (queryInterface) => {
    // order_item.product is used in report GROUP BY / joins (productSales,
    // profitPerProduct) with no supporting index — Postgres auto-indexes
    // neither this FK nor the join target.
    await queryInterface.addIndex('order_item', {
      name: 'order_item_product_idx',
      fields: ['product']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('order_item', 'order_item_product_idx')
  }
}
