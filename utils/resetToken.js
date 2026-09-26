'use strict'

const crypto = require('crypto')

// P0-1: the password-reset token is a bearer credential, so only a digest is
// persisted. The emailed link still carries the plaintext token; anyone who
// can read the `user` row learns nothing redeemable.
//
// Rows written before hashing hold the bare token (no prefix). They stay
// redeemable until their 15-minute expiry so an in-flight reset survives the
// deploy; the prefix keeps a stored digest from ever being accepted as a
// token itself.
const HASH_PREFIX = 'sha256:'

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest()

const hashResetToken = (token) =>
  HASH_PREFIX + crypto.createHash('sha256').update(String(token)).digest('hex')

const resetTokenMatches = (stored, supplied) => {
  if (typeof stored !== 'string' || stored === '') return false
  if (supplied == null || String(supplied) === '') return false
  const actual = stored.startsWith(HASH_PREFIX) ? hashResetToken(supplied) : String(supplied)
  // Compare fixed-length digests so the comparison time never depends on
  // where the values first differ.
  return crypto.timingSafeEqual(digest(stored), digest(actual))
}

module.exports = { hashResetToken, resetTokenMatches }
