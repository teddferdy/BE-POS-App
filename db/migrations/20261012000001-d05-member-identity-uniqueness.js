'use strict'

// D-05 product-grade member identity uniqueness (locked business contract).
//
// Replaces the never-executed historical attempts (20260620000004 global raw
// uniques and 20260913000001 name-only store scoping, both EXCLUDED_BY_DECISION)
// with the complete target integrity model:
//
//   1. name store-scoped, case-insensitive, soft-delete-excluded:
//        UNIQUE(store, LOWER(TRIM(name))) WHERE store IS NOT NULL
//          AND "deletedAt" IS NULL
//        UNIQUE(LOWER(TRIM(name))) WHERE store IS NULL
//          AND "deletedAt" IS NULL
//   2. phone globally unique on canonical E.164, soft-delete-excluded,
//      GUEST-* exempt:
//        UNIQUE("phoneNumber") WHERE "deletedAt" IS NULL
//          AND "phoneNumber" NOT LIKE 'GUEST-%'
//   3. email globally unique, case-insensitive, soft-delete-excluded,
//      NULL-tolerant:
//        UNIQUE(LOWER(TRIM(email))) WHERE "deletedAt" IS NULL
//          AND email IS NOT NULL
//
// FAIL-CLOSED execution model (single transaction):
//   preflight (SELECT-only) -> abort on any invalid/collision (counts only,
//   no values logged) -> backfill phones to E.164 -> create indexes.
// No DDL and no data rewrite occur before every preflight check passes.
// No automatic survivor selection, no renames, no deletes.
// Historical rename-based dedup behavior is NOT revived.
//
// Canonical definitions live in utils/memberIdentity.js and are shared with
// the application prechecks. Raw SQL is used because Sequelize cannot express
// partial expression indexes. No citext, no normalized columns, no
// CREATE INDEX CONCURRENTLY (forbidden inside a transaction; data volume
// does not require it).

const { canonicalPhone } = require('../../utils/memberIdentity')

const IDX_STORE_NAME = 'uq_member_store_name_ci'
const IDX_GLOBAL_NAME = 'uq_member_global_name_ci'
const IDX_PHONE = 'uq_member_phone_e164'
const IDX_EMAIL = 'uq_member_email_ci'

function abort(message, count) {
  const e = new Error(`D-05 preflight abort: ${message} (count=${count})`)
  e.code = 'D05_PREFLIGHT_ABORT'
  throw e
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // Every statement (including the existence probe) runs inside this
    // migration's own transaction: the repository runner provides none.
    await queryInterface.sequelize.transaction(async (t) => {
      const q = (sql, replacements) =>
        queryInterface.sequelize.query(sql, {
          replacements,
          type: Sequelize.QueryTypes.SELECT,
          transaction: t
        })
      const exec = (sql) =>
        queryInterface.sequelize.query(sql, { transaction: t })

      const tableExists = await q(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'member')`
      )
      if (!tableExists[0].exists) return

      // ---- Preflight 1: every active non-guest phone must be E.164-parseable.
      const phones = await q(
        `SELECT id, "phoneNumber" FROM "member"
         WHERE "deletedAt" IS NULL
           AND "phoneNumber" NOT LIKE 'GUEST-%'`
      )
      const canonicalById = new Map()
      let unparseable = 0
      for (const row of phones) {
        try {
          canonicalById.set(row.id, canonicalPhone(row.phoneNumber))
        } catch {
          unparseable += 1
        }
      }
      if (unparseable > 0) abort('unparseable active phone values', unparseable)

      // ---- Preflight 2: canonical phone collisions (global, active only).
      const seenPhones = new Map()
      let phoneCollisions = 0
      for (const canonical of canonicalById.values()) {
        seenPhones.set(canonical, (seenPhones.get(canonical) || 0) + 1)
        if (seenPhones.get(canonical) === 2) phoneCollisions += 1
      }
      if (phoneCollisions > 0) {
        abort('canonical phone collision groups', phoneCollisions)
      }

      // ---- Preflight 3: canonical name collisions per bucket (active only).
      // GROUP BY treats NULL stores as one group = the global bucket.
      const nameDupes = await q(
        `SELECT COUNT(*) AS groups FROM (
           SELECT store, LOWER(TRIM(name)), COUNT(*)
           FROM "member"
           WHERE "deletedAt" IS NULL AND name IS NOT NULL
           GROUP BY store, LOWER(TRIM(name))
           HAVING COUNT(*) > 1
         ) s`
      )
      if (Number(nameDupes[0].groups) > 0) {
        abort('canonical name collision groups', Number(nameDupes[0].groups))
      }

      // ---- Preflight 4: canonical email collisions (global, active only).
      const emailDupes = await q(
        `SELECT COUNT(*) AS groups FROM (
           SELECT LOWER(TRIM(email)), COUNT(*)
           FROM "member"
           WHERE "deletedAt" IS NULL AND email IS NOT NULL
           GROUP BY LOWER(TRIM(email))
           HAVING COUNT(*) > 1
         ) s`
      )
      if (Number(emailDupes[0].groups) > 0) {
        abort('canonical email collision groups', Number(emailDupes[0].groups))
      }

      // ---- Backfill: canonicalize parseable active non-guest phones only.
      // Names/emails need no rewrite (expression indexes). Guests untouched.
      for (const [id, canonical] of canonicalById) {
        await queryInterface.sequelize.query(
          `UPDATE "member" SET "phoneNumber" = :canonical
           WHERE id = :id AND "phoneNumber" IS DISTINCT FROM :canonical`,
          {
            replacements: { canonical, id },
            type: Sequelize.QueryTypes.UPDATE,
            transaction: t
          }
        )
      }

      // ---- Retire superseded historical member uniqueness objects if
      // present: the raw global constraints of 20260620000004
      // (uq_member_name / uq_member_phoneNumber / uq_member_email) and the
      // C13 objects of 20260913000001 (uq_member_store_name constraint,
      // uq_member_global_name index). Production/staging carry none of them
      // (W-02R.3R E6: member_pkey only); a database that executed the
      // historical chain must not keep enforcing stale raw/global semantics.
      // NOTE: errors must never be swallowed with .catch() inside this
      // explicit transaction — any failed statement aborts the whole
      // transaction in Postgres. Existence is checked first instead.
      await exec(
        `DROP INDEX IF EXISTS uq_member_global_name`
      )
      for (const legacyName of [
        'uq_member_name',
        'uq_member_phoneNumber',
        'uq_member_email',
        'uq_member_store_name'
      ]) {
        const legacyConstraint = await q(
          `SELECT 1 FROM pg_constraint
           WHERE conname = :legacyName
             AND conrelid = 'public.member'::regclass`,
          { legacyName }
        )
        if (legacyConstraint.length > 0) {
          await queryInterface.removeConstraint('member', legacyName, {
            transaction: t
          })
        }
      }

      // ---- Create the four target uniqueness objects.
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${IDX_STORE_NAME}
         ON "member" (store, (LOWER(TRIM(name))))
         WHERE store IS NOT NULL AND "deletedAt" IS NULL`
      )
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${IDX_GLOBAL_NAME}
         ON "member" ((LOWER(TRIM(name))))
         WHERE store IS NULL AND "deletedAt" IS NULL`
      )
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${IDX_PHONE}
         ON "member" ("phoneNumber")
         WHERE "deletedAt" IS NULL AND "phoneNumber" NOT LIKE 'GUEST-%'`
      )
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${IDX_EMAIL}
         ON "member" ((LOWER(TRIM(email))))
         WHERE "deletedAt" IS NULL AND email IS NOT NULL`
      )
    })
  },

  async down(queryInterface) {
    // Scoped reversal: drop only the four D-05 objects. Phone canonicals
    // stay canonical (derivable back to national form via formatter); no
    // un-canonicalization, no rename restoration, no constraint resurrection.
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS ${IDX_EMAIL}`
    )
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS ${IDX_PHONE}`
    )
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS ${IDX_GLOBAL_NAME}`
    )
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS ${IDX_STORE_NAME}`
    )
  }
}
