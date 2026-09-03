'use strict'
const os = require('os')

const HOLDER = `${os.hostname()}-${process.pid}`

// Cross-process scheduler lease, backed by a conditional upsert instead of a
// Postgres advisory lock — pg_advisory_lock is session-scoped and doesn't
// survive Sequelize returning the connection to its pool between queries, so
// it can't reliably guard work spread across a setInterval tick.
//
// Returns true if the caller won the lock for this tick (i.e. should run the
// scheduled work), false if another process already holds it. A healthy
// holder re-claims the lock every tick; if it crashes without releasing, the
// lease naturally expires after ttlMs and another instance takes over.
async function tryAcquireSchedulerLock(db, name, ttlMs) {
  const now = new Date()
  const until = new Date(now.getTime() + ttlMs)

  const rows = await db.sequelize.query(
    `INSERT INTO scheduler_lock (name, "lockedUntil", "lockedBy", "updatedAt")
     VALUES (:name, :until, :holder, NOW())
     ON CONFLICT (name) DO UPDATE
       SET "lockedUntil" = :until, "lockedBy" = :holder, "updatedAt" = NOW()
       WHERE scheduler_lock."lockedUntil" IS NULL
          OR scheduler_lock."lockedUntil" < :now
     RETURNING name`,
    {
      replacements: { name, until, holder: HOLDER, now },
      type: db.sequelize.QueryTypes.SELECT
    }
  )
  return rows.length > 0
}

module.exports = { tryAcquireSchedulerLock, HOLDER }
