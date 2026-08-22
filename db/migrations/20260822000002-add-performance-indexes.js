module.exports = {
  up: async (queryInterface) => {
    // hot path: order listing/reporting per store & time
    await queryInterface.addIndex('order', {
      name: 'order_store_createdAt',
      fields: ['store', 'createdAt']
    })
    await queryInterface.addIndex('order', {
      name: 'order_store_status',
      fields: ['store', 'status']
    })
    // FK index: Postgres does not auto-index foreign keys;
    // order <-> order_item joins and cascades need this
    await queryInterface.addIndex('order_item', {
      name: 'order_item_order_idx',
      fields: ['order']
    })
    // append-heavy audit table queried by store + date range / product
    await queryInterface.addIndex('stock_history', {
      name: 'stock_history_store_createdAt',
      fields: ['store', 'createdAt']
    })
    await queryInterface.addIndex('stock_history', {
      name: 'stock_history_product',
      fields: ['product']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('stock_history', 'stock_history_product')
    await queryInterface.removeIndex(
      'stock_history',
      'stock_history_store_createdAt'
    )
    await queryInterface.removeIndex('order_item', 'order_item_order_idx')
    await queryInterface.removeIndex('order', 'order_store_status')
    await queryInterface.removeIndex('order', 'order_store_createdAt')
  }
}
