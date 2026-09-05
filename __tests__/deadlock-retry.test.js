const { withDeadlockRetry, isRetryableDeadlockError } = require('../utils/deadlockRetry')

const deadlockError = () => {
  const err = new Error('deadlock detected')
  err.parent = { code: '40P01' }
  return err
}

const serializationError = () => {
  const err = new Error('could not serialize access')
  err.parent = { code: '40001' }
  return err
}

describe('isRetryableDeadlockError', () => {
  test('recognizes 40P01 (deadlock_detected) and 40001 (serialization_failure)', () => {
    expect(isRetryableDeadlockError(deadlockError())).toBe(true)
    expect(isRetryableDeadlockError(serializationError())).toBe(true)
  })

  test('does not treat an unrelated DB error as retryable', () => {
    const err = new Error('not null violation')
    err.parent = { code: '23502' }
    expect(isRetryableDeadlockError(err)).toBe(false)
  })

  test('does not treat a plain application error as retryable', () => {
    expect(isRetryableDeadlockError(new Error('insufficient stock'))).toBe(false)
  })
})

describe('withDeadlockRetry', () => {
  test('returns the result on first success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    const result = await withDeadlockRetry(fn, { baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('retries on a deadlock error and succeeds once the deadlock clears', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(deadlockError())
      .mockResolvedValueOnce('recovered')
    const result = await withDeadlockRetry(fn, { baseDelayMs: 1 })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('gives up after exceeding the retry budget and throws the last error', async () => {
    const fn = jest.fn().mockRejectedValue(deadlockError())
    await expect(
      withDeadlockRetry(fn, { retries: 2, baseDelayMs: 1 })
    ).rejects.toThrow('deadlock detected')
    // Initial attempt + 2 retries = 3 calls total.
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('does not retry a non-deadlock error — fails immediately', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('insufficient stock'))
    await expect(withDeadlockRetry(fn, { baseDelayMs: 1 })).rejects.toThrow(
      'insufficient stock'
    )
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
