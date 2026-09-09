'use strict'

// Phase 3 remediation — accounting & AR integrity.
//
// 1. journal_entry: at most one LIVE entry per business event
//    UNIQUE (store, sourceType, referenceId) WHERE "deletedAt" IS NULL.
//    Partial on live rows because entries are paranoid (soft deleted): the
//    expense lifecycle legitimately produces a soft-deleted row followed by a
//    new live row for the SAME (store, sourceType, referenceId) when a
//    reverted expense is re-approved. A full unique index over all rows would
//    break that flow and also be impossible on existing data (dev has
//    soft-deleted duplicate pairs, e.g. store 1 expense 7).
//
// 2. journal_entry: unique per-store entryNumber
//    UNIQUE (store, entryNumber). Safe on existing data — no duplicates —
//    and safe going forward because the atomic counter below is monotonic and
//    never reuses a number already issued to any row (live or soft-deleted).
//
// 3. journal_entry_sequence: per-store atomic counter table replacing the old
//    MAX(id)+1 race (two concurrent postings read the same MAX(id) and issued
//    the same entryNumber). Seeded from MAX(id) so the first new number equals
//    what the old formula would have produced. The code increments it with
//    INSERT ... ON CONFLICT (store) DO UPDATE SET counter = counter + 1
//    RETURNING counter — atomic even under concurrency, no application lock.
//
// 4. ar_payment: partial unique index (arId, reference) WHERE reference IS
//    NOT NULL — lets POST /accounts-receivable/:id/pay treat a customer
//    reference as an idempotency key, so a retried submission can never
//    apply the same payment twice. Existing data has no duplicates.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // --- Pre-migration integrity checks (fail safely, never coerce) ---

    const liveDupes = await queryInterface.sequelize.query(
      `SELECT store, "sourceType", "referenceId", COUNT(*) AS c
       FROM journal_entry
       WHERE "deletedAt" IS NULL
       GROUP BY store, "sourceType", "referenceId"
       HAVING COUNT(*) > 1
       LIMIT 5`
    )
    if (liveDupes[0].length > 0) {
      throw new Error(
        `Migration aborted: ${JSON.stringify(liveDupes[0])} — LIVE journal_entry rows duplicate (store, sourceType, referenceId). Resolve before adding the unique index.`
      )
    }

    const entryNumberDupes = await queryInterface.sequelize.query(
      `SELECT store, "entryNumber", COUNT(*) AS c
       FROM journal_entry
       GROUP BY store, "entryNumber"
       HAVING COUNT(*) > 1
       LIMIT 5`
    )
    if (entryNumberDupes[0].length > 0) {
      throw new Error(
        `Migration aborted: ${JSON.stringify(entryNumberDupes[0])} — journal_entry rows duplicate (store, entryNumber). Resolve before adding the unique index.`
      )
    }

    const arPaymentDupes = await queryInterface.sequelize.query(
      `SELECT "arId", reference, COUNT(*) AS c
       FROM ar_payment
       WHERE reference IS NOT NULL
       GROUP BY "arId", reference
       HAVING COUNT(*) > 1
       LIMIT 5`
    )
    if (arPaymentDupes[0].length > 0) {
      throw new Error(
        `Migration aborted: ${JSON.stringify(arPaymentDupes[0])} — ar_payment rows duplicate (arId, reference). Resolve before adding the unique index.`
      )
    }

    // --- journal_entry: one live entry per business event ---
    await queryInterface.addIndex('journal_entry', {
      name: 'journal_entry_store_source_reference_uniq',
      unique: true,
      fields: ['store', 'sourceType', 'referenceId'],
      where: { deletedAt: null }
    })

    // --- journal_entry: unique per-store entryNumber ---
    await queryInterface.addIndex('journal_entry', {
      name: 'journal_entry_store_entrynumber_uniq',
      unique: true,
      fields: ['store', 'entryNumber']
    })

    // --- journal_entry_sequence: atomic per-store numbering ---
    await queryInterface.createTable(
      'journal_entry_sequence',
      {
        store: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        counter: {
          type: Sequelize.BIGINT,
          allowNull: false,
          defaultValue: 0
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      },
      { freezeTableName: true, tableName: 'journal_entry_sequence' }
    )
    await queryInterface.sequelize.query(
      `INSERT INTO journal_entry_sequence (store, counter, "createdAt", "updatedAt")
       SELECT store, COALESCE(MAX(id), 0), NOW(), NOW()
       FROM journal_entry
       GROUP BY store`
    )

    // --- ar_payment: reference as idempotency key ---
    await queryInterface.addIndex('ar_payment', {
      name: 'ar_payment_arid_reference_uniq',
      unique: true,
      fields: ['arId', 'reference'],
      where: { reference: { [Sequelize.Op.ne]: null } }
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('ar_payment', 'ar_payment_arid_reference_uniq')
    await queryInterface.dropTable('journal_entry_sequence')
    await queryInterface.removeIndex(
      'journal_entry',
      'journal_entry_store_entrynumber_uniq'
    )
    await queryInterface.removeIndex(
      'journal_entry',
      'journal_entry_store_source_reference_uniq'
    )
  }
}