module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Phase 22 Batch 4 — AP reminder idempotency ledger.
    //
    // Purely an at-most-once event record: "this PO reached this
    // classification, on this store-local business date". It does NOT
    // duplicate the notification/outbox infrastructure — it exists only
    // because neither `notification` nor `accounting_outbox` has a
    // column for the composite key a reminder needs (store +
    // purchaseOrder + classification + businessDate), and adding one
    // to either shared, cross-feature table would be a broader change
    // than this ledger needs. The actual user-visible notification is
    // still created via the existing createNotification() (notification
    // table + socket emit); notificationId here just links back to it.
    //
    // Rows are immutable once inserted (no update/soft-delete) — the
    // UNIQUE index is the entire safety mechanism: two schedulers ticking
    // concurrently, or the same scheduler re-evaluating the same PO on a
    // later tick within the same business date, both attempt the same
    // INSERT; only one wins, the other's unique-violation is treated as
    // "already generated" and skipped. Same pattern already proven by
    // journal_entry's (store, sourceType, referenceId) unique index
    // (20260909000001-phase3-accounting-integrity.js).
    await queryInterface.createTable('ap_reminder_event', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      store: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      purchaseOrder: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      classification: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      businessDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      notificationId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    })

    await queryInterface.addIndex('ap_reminder_event', {
      name: 'ap_reminder_event_idempotency_key',
      unique: true,
      fields: ['store', 'purchaseOrder', 'classification', 'businessDate']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ap_reminder_event')
  }
}
