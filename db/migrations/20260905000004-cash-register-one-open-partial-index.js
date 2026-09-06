'use strict'

module.exports = {
  up: async (queryInterface) => {
    // Self-healing: if any store currently has more than one open
    // register (a realistic possibility given today's un-enforced
    // invariant), force-close every one except the most recently opened,
    // tagging the forced closures distinctly so they're auditable rather
    // than silently discarded. Only after that is it safe to add the
    // constraint below.
    await queryInterface.sequelize.query(`
      UPDATE cash_register cr
      SET status = 'closed',
          "closedAt" = NOW(),
          notes = COALESCE(notes || ' ', '') || '[auto-closed by F2 migration: duplicate open register]'
      WHERE cr.status = 'open'
        AND cr.id NOT IN (
          SELECT DISTINCT ON (store) id FROM cash_register
          WHERE status = 'open'
          ORDER BY store, "openedAt" DESC
        )
    `)

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX cash_register_store_open_unique
      ON cash_register (store)
      WHERE status = 'open'
    `)
  },
  down: async (queryInterface) => {
    // Only drops the index — does not attempt to reopen the auto-closed
    // duplicates (that would be a fabricated, undocumented business
    // decision). Auto-closed rows remain visible via their notes tag and
    // the audit log.
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS cash_register_store_open_unique'
    )
  }
}
