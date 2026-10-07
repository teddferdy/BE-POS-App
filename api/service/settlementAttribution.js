'use strict'

const db = require('../../db/models')
const { financialError } = require('./orderFinancials')

// PAYMENT P1 Register & Settlement Attribution — register resolution with
// register-close-compatible locking (DR-PAY-ATTR-03).
//
// Locked contract:
//   resolve candidate register -> acquire SHARE lock -> verify status = open
//   -> write financial event referencing that register -> commit.
//
// Register close holds UPDATE, which conflicts with SHARE in both
// directions, so attribution and close serialize: whoever locks first wins
// and the loser observes the winner's committed state. Two-phase shape
// (find, then lock+verify) exists so the race window is explicit and
// testable — production paths must always call both back-to-back inside
// the SAME financial transaction, never resolve in one transaction and
// write in another.
//
// Errors use the repository's financial error shape:
//   422 REGISTER_REQUIRED      — no open register for the store
//   409 REGISTER_STATE_CHANGED — resolved register closed before commit

async function findOpenRegister(storeId, transaction) {
  if (storeId === null || storeId === undefined) {
    throw financialError(
      422,
      'REGISTER_REQUIRED',
      'No store context to resolve an open cash register'
    )
  }
  const candidate = await db.cashRegister.findOne({
    where: { store: storeId, status: 'open' },
    transaction
  })
  if (!candidate) {
    throw financialError(
      422,
      'REGISTER_REQUIRED',
      'No open cash register for this store; open a register before settling'
    )
  }
  return candidate
}

async function lockAndVerifyRegister(registerId, transaction) {
  const locked = await db.cashRegister.findOne({
    where: { id: registerId },
    lock: transaction.LOCK.SHARE,
    transaction
  })
  // READ COMMITTED + SHARE: if a concurrent close() committed first, this
  // lock waited for it and now returns the closed row — refuse instead of
  // attributing money to a closed shift. Never fall through to another
  // register here; retry is the caller's new financial attempt.
  if (!locked || locked.status !== 'open') {
    throw financialError(
      409,
      'REGISTER_STATE_CHANGED',
      'The register closed before the financial event committed; retry against the current open register'
    )
  }
  return locked
}

async function resolveAttributedRegister(storeId, transaction) {
  const candidate = await findOpenRegister(storeId, transaction)
  return lockAndVerifyRegister(candidate.id, transaction)
}

module.exports = {
  findOpenRegister,
  lockAndVerifyRegister,
  resolveAttributedRegister
}
