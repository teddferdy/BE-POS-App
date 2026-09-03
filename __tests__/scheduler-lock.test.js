process.env.NODE_ENV = 'test'

const db = require('../db/models')
const { tryAcquireSchedulerLock } = require('../utils/schedulerLock')

afterAll(async () => {
  await db.sequelize.query(
    `DELETE FROM scheduler_lock WHERE name IN ('test-lock-a', 'test-lock-b', 'test-lock-c')`
  )
})

describe('tryAcquireSchedulerLock — cross-process scheduler lease', () => {
  test('only one caller wins the lock while it is held', async () => {
    const first = await tryAcquireSchedulerLock(db, 'test-lock-a', 60000)
    expect(first).toBe(true)

    // A second instance racing for the same name within the TTL loses.
    const second = await tryAcquireSchedulerLock(db, 'test-lock-a', 60000)
    expect(second).toBe(false)
  })

  test('a new name is independent of an already-held lock', async () => {
    const res = await tryAcquireSchedulerLock(db, 'test-lock-b', 60000)
    expect(res).toBe(true)
  })

  test('the lock can be re-acquired once its TTL has expired', async () => {
    const name = 'test-lock-c'
    const won = await tryAcquireSchedulerLock(db, name, 1) // 1ms TTL
    expect(won).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 20))

    const wonAgain = await tryAcquireSchedulerLock(db, name, 60000)
    expect(wonAgain).toBe(true)
  })
})
