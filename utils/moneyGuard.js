'use strict'

// F-MON-1: integer-rupiah boundary guard for money inputs.
//
// Contractually integer rupiah amounts must be rejected before
// persistence/math — never silently truncated (parseInt/Math.floor),
// rounded by the DB driver, or overflowed into a raw 500. All failures
// throw a plain Error with .statusCode = 422, matching the existing
// semantic-error convention (validateCashTender, cash movement); every
// call site below was verified to surface error.statusCode.
const INT4_MAX = 2147483647

function assertIntegerRupiah(value, field = 'amount', { max = INT4_MAX } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > max) {
    const e = new Error(
      `${field} must be a non-negative integer rupiah amount` +
        (max === INT4_MAX ? ' within INT4 range' : '')
    )
    e.statusCode = 422
    throw e
  }
  return n
}

module.exports = { INT4_MAX, assertIntegerRupiah }
