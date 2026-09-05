module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Durable retry queue for accounting journal posting. Every place that
    // used to call postXJournal(...) as a best-effort side effect after its
    // own transaction committed (order creation, sales return approval,
    // purchase payment recording, expense approval, goods receipt, ...) now
    // ALSO inserts a row here inside that same transaction — a plain INSERT
    // can't fail independently the way an HTTP call to an accounting
    // function can, so the row's existence is as durable as the business
    // event itself. The immediate post-commit posting attempt is kept for
    // the common case (accounting entries usually appear right away), but
    // a transient failure there no longer means "gone forever, logged to
    // stdout" — the row stays `pending` and a scheduler (see
    // accountingOutboxScheduler.js) retries it with bounded attempts and
    // marks it `failed` (with the real error preserved) once exhausted,
    // instead of silently discarding the fact that a real business event
    // never made it into the books.
    await queryInterface.createTable('accounting_outbox', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      jobType: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      store: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      referenceType: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      referenceId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending'
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lastError: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      postedAt: {
        type: Sequelize.DATE,
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

    // The scheduler's drain query is always "pending/failed rows below the
    // attempt cap, oldest first" — this is the only access pattern that
    // matters for it, so index exactly that.
    await queryInterface.addIndex('accounting_outbox', ['status', 'createdAt'], {
      name: 'accounting_outbox_status_created_idx'
    })
    await queryInterface.addIndex('accounting_outbox', ['referenceType', 'referenceId'], {
      name: 'accounting_outbox_reference_idx'
    })
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('accounting_outbox')
  }
}
