const crypto = require('crypto')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // The unauthenticated customer-facing order-tracking and receipt-html
    // endpoints previously looked orders up by their raw sequential integer
    // id, which meant anyone could enumerate every order (customer name,
    // totals, payment status, items, branch details) across every store by
    // incrementing the id in the URL — no credentials required. Those
    // endpoints must stay unauthenticated (customers place orders without
    // logging in), so the fix is to require knowledge of a per-order random
    // token instead of the guessable id.
    await queryInterface.addColumn('order', 'publicToken', {
      type: Sequelize.STRING(64),
      allowNull: true
    })
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX order_public_token_unique
      ON "order" ("publicToken")
      WHERE "publicToken" IS NOT NULL
    `)

    // Backfill existing rows so previously-placed orders remain reachable
    // by staff/customers who already have a link, instead of silently
    // breaking on migration day. New orders get a token at creation time
    // (see api/controller/order.js), so this only ever runs once per row.
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id FROM "order" WHERE "publicToken" IS NULL'
    )
    for (const row of rows) {
      const token = crypto.randomBytes(24).toString('hex')
      await queryInterface.sequelize.query(
        'UPDATE "order" SET "publicToken" = :token WHERE id = :id',
        { replacements: { token, id: row.id } }
      )
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('order', 'order_public_token_unique')
    await queryInterface.removeColumn('order', 'publicToken')
  }
}
