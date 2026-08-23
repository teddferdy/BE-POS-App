module.exports = {
  up: async (queryInterface) => {
    // ponytail: FK tanpa index — Postgres tidak auto-index FK;
    // join order <-> transaction di detail/pembayaran scan penuh tanpa ini
    await queryInterface.addIndex('transaction', {
      name: 'transaction_order_idx',
      fields: ['order']
    })
    // hot path notifikasi: poll unread per sesi (WHERE store=? AND is_read=false)
    await queryInterface.addIndex('notification', {
      name: 'notification_store_isRead',
      fields: ['store', 'isRead']
    })
    // list notifikasi ORDER BY updated_at DESC
    await queryInterface.addIndex('notification', {
      name: 'notification_updatedAt',
      fields: ['updatedAt']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('notification', 'notification_updatedAt')
    await queryInterface.removeIndex('notification', 'notification_store_isRead')
    await queryInterface.removeIndex('transaction', 'transaction_order_idx')
  }
}
