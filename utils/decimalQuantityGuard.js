'use strict'

// Phase 34 — stock-opname quantity boundary guard, mirroring the
// assertIntegerRupiah (utils/moneyGuard.js) convention: throw a plain Error
// with .statusCode = 422 so it surfaces cleanly through the controller's
// existing error handling, rather than a raw 500.
//
// DECIMAL(10,4): 10 total digits, 4 after the decimal point -> max
// magnitude 999999.9999. Values may be negative (e.g. selisihJumlah) —
// this guard only validates type/finiteness/precision/magnitude, it does
// not impose a sign restriction that doesn't already exist in the code it
// protects (stock-opname never rejected a negative selisih).
const MAX_MAGNITUDE = 999999.9999
const MAX_DECIMAL_PLACES = 4
const SCALE = 10 ** MAX_DECIMAL_PLACES
const EPSILON = 1e-6

function assertDecimalQuantity(value, field = 'value') {
  const fail = (message) => {
    const e = new Error(message)
    e.statusCode = 422
    throw e
  }

  if (typeof value !== 'number') {
    fail(`${field} must be a number`)
  }
  if (!Number.isFinite(value)) {
    fail(`${field} must be a finite number`)
  }
  if (Math.abs(value) > MAX_MAGNITUDE) {
    fail(`${field} exceeds the maximum supported magnitude of ${MAX_MAGNITUDE}`)
  }

  // Round-trip through a 4-decimal-place scale and compare within a tight
  // floating-point tolerance, rather than counting digits in the raw
  // string — a value that's the exact RESULT of decimal arithmetic (e.g.
  // 12.5 + 3.25 - 1.5) can carry harmless binary-representation noise far
  // past the 4th decimal digit even though none of its inputs had more
  // than 4 decimal places. A genuinely-higher-precision value (e.g.
  // 1.23456) still fails this check, since the mismatch is far larger
  // than floating-point noise.
  const scaled = value * SCALE
  if (Math.abs(scaled - Math.round(scaled)) > EPSILON) {
    fail(`${field} supports at most ${MAX_DECIMAL_PLACES} decimal places`)
  }

  return value
}

module.exports = { assertDecimalQuantity, MAX_MAGNITUDE, MAX_DECIMAL_PLACES }
