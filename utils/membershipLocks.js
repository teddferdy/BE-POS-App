'use strict'

// Shared row-lock primitives for membership/assignment authority (T-03A D5-B,
// D12; T-03B switch serialization). Every path that decides authority from
// memberships or assignments and then writes a session row takes these locks
// FIRST, in one global order:
//
//   user's membership set (ascending tenantId) → assignment row → session row
//
// T-03A reductions (membership set → session updates), assignment mutations
// (assignment → session updates) and the session switches (membership set →
// assignment → session) all follow it, so no two of them can wait on each
// other in a cycle. Plain FOR UPDATE row locks only: no isolation change, no
// advisory or custom locks.

// The user's WHOLE membership set (soft-deleted rows excluded by the paranoid
// default scope), in one statement, ascending tenantId. Returned keyed by
// tenantId.
const lockUserMemberships = async (db, userId, transaction) => {
  const rows = await db.tenantMembership.findAll({
    where: { userId },
    order: [['tenantId', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE
  })
  return new Map(rows.map((row) => [Number(row.tenantId), row]))
}

// One assignment row, locked when it exists.
const lockAssignment = (db, userId, storeId, transaction) =>
  db.storeAssignment.findOne({ where: { userId, storeId }, transaction, lock: transaction.LOCK.UPDATE })

module.exports = { lockUserMemberships, lockAssignment }
