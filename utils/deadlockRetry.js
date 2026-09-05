'use strict'

// Postgres deadlock_detected / serialization_failure.
const RETRYABLE_CODES = new Set(['40P01', '40001'])

const isRetryableDeadlockError = (err) => {
  const code = err?.parent?.code || err?.original?.code
  return RETRYABLE_CODES.has(code)
}

/**
 * Retries a function that opens and runs its own Postgres transaction if
 * it fails with a deadlock (40P01) or serialization failure (40001).
 *
 * This is defense in depth alongside consistent lock ordering, not a
 * substitute for it — a transaction that can't be written to lock rows in
 * a stable order (or whose lock order genuinely can't be predicted ahead
 * of time) still benefits from this, since Postgres's deadlock detector
 * guarantees killing one side of a real deadlock, and that side can
 * usually just be re-run from scratch safely.
 *
 * @param {() => Promise<any>} fn - must be safe to call again from
 *   scratch on failure (e.g. wraps its own `db.sequelize.transaction`)
 * @param {object} [options]
 * @param {number} [options.retries=2]
 * @param {number} [options.baseDelayMs=50]
 * @returns {Promise<any>}
 */
async function withDeadlockRetry(fn, { retries = 2, baseDelayMs = 50 } = {}) {
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (!isRetryableDeadlockError(err) || attempt >= retries) throw err
      attempt += 1
      const jitter = Math.random() * baseDelayMs
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * attempt + jitter)
      )
    }
  }
}

module.exports = { withDeadlockRetry, isRetryableDeadlockError }
