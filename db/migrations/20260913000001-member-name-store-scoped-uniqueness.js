'use strict'

// C13: `uq_member_name` (added by 20260620000004) is a GLOBAL unique
// constraint on member.name, but the application (api/controller/member.js
// addNewMember/editMember) has always scoped its own duplicate-name check
// by store — `{ name, store }` for a tenant member, `{ name, store: null }`
// for a chain-wide "global" member (store: null). The DB constraint is
// stricter than the app intends: two different stores can never register a
// member with the same name, even though the app already allows it.
//
// This migration relaxes the DB constraint to match the app's own semantics
// exactly:
//   - same store + same name -> rejected (composite unique constraint)
//   - different stores + same name -> allowed
//   - two global (store IS NULL) members with the same name -> rejected too,
//     mirroring the app's `store: null` dedup bucket for chain-wide members
//     (see the C-9 comments in editMember/deleteMember). A plain composite
//     UNIQUE(store, name) constraint does NOT cover this on its own, because
//     Postgres never treats two NULLs as equal for uniqueness purposes, so a
//     separate partial unique index is required for that bucket.
//
// Like the original migration, this does not filter out soft-deleted
// (deletedAt IS NOT NULL) rows from the uniqueness check -- that gap already
// existed on the constraint being replaced and is unrelated to C13.

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'member')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    // Defensive dedup before tightening any constraint, following the exact
    // pattern already established by 20260620000004 (rename losers to
    // "<name> (<n>)", keep the lowest id untouched). Verified against
    // current dev/test data that no (store, name) collisions exist, but the
    // guard is kept so this migration is safe to run against any
    // environment (e.g. production) without assuming that.
    const dupRows = await queryInterface.sequelize.query(
      `SELECT store, name FROM "member" GROUP BY store, name HAVING COUNT(*) > 1`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    for (const { store, name } of dupRows) {
      const rows = await queryInterface.sequelize.query(
        `SELECT id FROM "member" WHERE name = :name AND store IS NOT DISTINCT FROM :store ORDER BY id`,
        {
          replacements: { name, store },
          type: Sequelize.QueryTypes.SELECT
        }
      )
      for (let i = 1; i < rows.length; i++) {
        await queryInterface.sequelize.query(
          `UPDATE "member" SET name = :newName WHERE id = :id`,
          {
            replacements: { newName: `${name} (${i})`, id: rows[i].id },
            type: Sequelize.QueryTypes.UPDATE
          }
        )
      }
    }

    // Drop the old global constraint if present. It may not exist at all in
    // some environments (confirmed: neither the local dev nor test database
    // currently has it, despite the migration that created it being marked
    // applied in dev) -- guarded exactly like this migration's own down().
    await queryInterface.removeConstraint('member', 'uq_member_name').catch(() => {})

    await queryInterface.addConstraint('member', {
      fields: ['store', 'name'],
      type: 'unique',
      name: 'uq_member_store_name'
    }).catch(() => {})

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_member_global_name
      ON "member" (name)
      WHERE store IS NULL
    `)
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS uq_member_global_name'
    )
    await queryInterface.removeConstraint('member', 'uq_member_store_name').catch(() => {})

    // Not restoring the old global uq_member_name here: by the time this
    // migration is rolled back, different stores may legitimately share a
    // member name (that's the whole point of this change), so blindly
    // recreating a global unique constraint could fail on real data or
    // silently reintroduce the C13 bug. Restoring it, if ever needed, is a
    // separate, deliberate decision -- not this migration's job.
  }
}
