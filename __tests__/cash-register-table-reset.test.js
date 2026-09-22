process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 39 Batch 6C — table reset on register open.
//
// Locked spec: the ONLY population eligible for reset-on-open cleanup is
// OCCUPIED tables with NO order in an active status
// (pending/confirmed/preparing/ready/served — same list table.js already
// uses for its own active-order checks). RESERVED, MAINTENANCE, AVAILABLE,
// and OCCUPIED-with-an-active-order must never be touched. The reset is
// best-effort: register creation must succeed regardless of whether
// cleanup was requested, ran cleanly, partially failed, or threw
// entirely. Eligibility must be recomputed authoritatively on BE for both
// the preview endpoint and the actual cleanup — never trusted from a
// client-supplied id list/count.

const SUFFIX = Date.now()
const createdStoreIds = []
const createdTableIds = []
const createdOrderIds = []
const createdRegisterIds = []

let opener = null

const tokenFor = (storeId) =>
  jwt.sign(
    { id: opener.id, userName: opener.userName, roleType: 'admin', store: storeId },
    JWT_SECRET
  )

async function mkStore(name) {
  const store = await db.location.create({ name: `TR_${name}_${SUFFIX}` })
  createdStoreIds.push(store.id)
  return store
}

async function mkTable(storeId, name, status) {
  const table = await db.table.create({
    store: storeId,
    name: `${name}_${SUFFIX}`,
    status
  })
  createdTableIds.push(table.id)
  return table
}

async function mkOrder(storeId, tableId, status) {
  const order = await db.order.create({
    orderNumber: `TR-${storeId}-${tableId}-${status}-${SUFFIX}-${Math.random().toString(36).slice(2, 7)}`,
    store: storeId,
    tableId,
    status,
    paymentStatus: status === 'paid' ? 'paid' : 'unpaid',
    source: 'pos',
    totalPrice: 0
  })
  createdOrderIds.push(order.id)
  return order
}

afterAll(async () => {
  await db.order.destroy({ where: { id: createdOrderIds }, force: true }).catch(() => {})
  await db.cashRegister
    .destroy({ where: { id: createdRegisterIds }, force: true })
    .catch(() => {})
  await db.table.destroy({ where: { id: createdTableIds }, force: true }).catch(() => {})
  await db.location.destroy({ where: { id: createdStoreIds }, force: true }).catch(() => {})
  await db.user.destroy({ where: { id: opener?.id }, force: true }).catch(() => {})
})

beforeAll(async () => {
  opener = await db.user.create({
    userName: `tr_opener_${SUFFIX}`,
    roleType: 'admin',
    password: 'x'
  })
})

describe('Phase 39 Batch 6C — GET /cash-register/table-reset-preview', () => {
  test('1 — counts only OCCUPIED tables with no active order, in a mixed population', async () => {
    const store = await mkStore('PREVIEW_MIXED')
    const tAvailable = await mkTable(store.id, 'available', 'available')
    const tOccupiedActive = await mkTable(store.id, 'occ_active', 'occupied')
    const tOccupiedNoOrder = await mkTable(store.id, 'occ_no_order', 'occupied')
    const tOccupiedPaidOrder = await mkTable(store.id, 'occ_paid', 'occupied')
    const tReserved = await mkTable(store.id, 'reserved', 'reserved')
    const tMaintenance = await mkTable(store.id, 'maintenance', 'maintenance')
    await mkOrder(store.id, tOccupiedActive.id, 'pending')
    await mkOrder(store.id, tOccupiedPaidOrder.id, 'paid')
    void tAvailable
    void tReserved
    void tMaintenance
    void tOccupiedNoOrder

    const res = await request(app)
      .get('/cash-register/table-reset-preview')
      .query({ store: store.id })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    expect(res.status).toBe(200)
    // Eligible: occ_no_order (no order at all) + occ_paid (order exists but
    // its status is not in the active list) = 2.
    expect(res.body.data.eligibleCount).toBe(2)
  })

  test('2 — excludes OCCUPIED tables that have an active order', async () => {
    const store = await mkStore('PREVIEW_ACTIVE_ONLY')
    const t = await mkTable(store.id, 'occ_active', 'occupied')
    await mkOrder(store.id, t.id, 'preparing')

    const res = await request(app)
      .get('/cash-register/table-reset-preview')
      .query({ store: store.id })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    expect(res.status).toBe(200)
    expect(res.body.data.eligibleCount).toBe(0)
  })

  test('3 — excludes RESERVED tables', async () => {
    const store = await mkStore('PREVIEW_RESERVED_ONLY')
    await mkTable(store.id, 'reserved', 'reserved')

    const res = await request(app)
      .get('/cash-register/table-reset-preview')
      .query({ store: store.id })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    expect(res.status).toBe(200)
    expect(res.body.data.eligibleCount).toBe(0)
  })

  test('4 — excludes MAINTENANCE tables', async () => {
    const store = await mkStore('PREVIEW_MAINTENANCE_ONLY')
    await mkTable(store.id, 'maintenance', 'maintenance')

    const res = await request(app)
      .get('/cash-register/table-reset-preview')
      .query({ store: store.id })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    expect(res.status).toBe(200)
    expect(res.body.data.eligibleCount).toBe(0)
  })

  test('5 — excludes AVAILABLE tables', async () => {
    const store = await mkStore('PREVIEW_AVAILABLE_ONLY')
    await mkTable(store.id, 'available', 'available')

    const res = await request(app)
      .get('/cash-register/table-reset-preview')
      .query({ store: store.id })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    expect(res.status).toBe(200)
    expect(res.body.data.eligibleCount).toBe(0)
  })
})

describe('Phase 39 Batch 6C — POST /cash-register/open with confirmTableReset', () => {
  test('6/7/8/9 — confirmed open resets only OCCUPIED+no-active-order, leaves the rest untouched', async () => {
    const store = await mkStore('OPEN_CLEANUP_SUCCESS')
    const eligible = await mkTable(store.id, 'eligible', 'occupied')
    const occupiedActive = await mkTable(store.id, 'occ_active', 'occupied')
    await mkOrder(store.id, occupiedActive.id, 'served')
    const reserved = await mkTable(store.id, 'reserved', 'reserved')
    const maintenance = await mkTable(store.id, 'maintenance', 'maintenance')

    const res = await request(app)
      .post('/cash-register/open')
      .send({ store: store.id, openingBalance: 100000, confirmTableReset: true })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    expect(res.status).toBe(201)
    createdRegisterIds.push(res.body.data.id)
    expect(res.body.tableCleanupResult).toEqual({
      attempted: true,
      succeeded: 1,
      failed: 0
    })

    const [eligibleAfter, activeAfter, reservedAfter, maintenanceAfter] = await Promise.all([
      db.table.findByPk(eligible.id),
      db.table.findByPk(occupiedActive.id),
      db.table.findByPk(reserved.id),
      db.table.findByPk(maintenance.id)
    ])
    expect(eligibleAfter.status).toBe('available')
    expect(activeAfter.status).toBe('occupied')
    expect(reservedAfter.status).toBe('reserved')
    expect(maintenanceAfter.status).toBe('maintenance')
  })

  test('10/11 — register opens successfully even when cleanup throws entirely, and the failure is reported', async () => {
    const store = await mkStore('OPEN_CLEANUP_FULL_THROW')
    const eligible = await mkTable(store.id, 'eligible', 'occupied')

    const findAllSpy = jest.spyOn(db.table, 'findAll').mockRejectedValueOnce(new Error('simulated DB failure'))

    const res = await request(app)
      .post('/cash-register/open')
      .send({ store: store.id, openingBalance: 100000, confirmTableReset: true })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    findAllSpy.mockRestore()

    expect(res.status).toBe(201)
    createdRegisterIds.push(res.body.data.id)
    expect(res.body.tableCleanupResult.attempted).toBe(true)
    expect(res.body.tableCleanupResult.succeeded).toBe(0)
    expect(res.body.tableCleanupResult.failed).toBe(0)
    expect(res.body.tableCleanupResult.warning).toBeDefined()

    // Register itself is genuinely open in the DB despite the thrown cleanup.
    const registerRow = await db.cashRegister.findByPk(res.body.data.id)
    expect(registerRow.status).toBe('open')
    // The eligible table is left as-is (cleanup never got to run).
    const eligibleAfter = await db.table.findByPk(eligible.id)
    expect(eligibleAfter.status).toBe('occupied')
  })

  test('12 — partial cleanup failure reports attempted/succeeded/failed accurately', async () => {
    const store = await mkStore('OPEN_CLEANUP_PARTIAL')
    const eligibleA = await mkTable(store.id, 'eligible_a', 'occupied')
    const eligibleB = await mkTable(store.id, 'eligible_b', 'occupied')

    const updateSpy = jest.spyOn(db.table, 'update').mockRejectedValueOnce(new Error('simulated update failure'))

    const res = await request(app)
      .post('/cash-register/open')
      .send({ store: store.id, openingBalance: 100000, confirmTableReset: true })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    updateSpy.mockRestore()

    expect(res.status).toBe(201)
    createdRegisterIds.push(res.body.data.id)
    expect(res.body.tableCleanupResult.attempted).toBe(true)
    expect(res.body.tableCleanupResult.succeeded).toBe(1)
    expect(res.body.tableCleanupResult.failed).toBe(1)
    expect(res.body.tableCleanupResult.warning).toBeDefined()

    const [aAfter, bAfter] = await Promise.all([
      db.table.findByPk(eligibleA.id),
      db.table.findByPk(eligibleB.id)
    ])
    const statuses = [aAfter.status, bAfter.status].sort()
    // Exactly one succeeded (available) and one failed (still occupied) —
    // which specific table hit the mocked rejection isn't the point, only
    // that the accounting matches the actual resulting DB state.
    expect(statuses).toEqual(['available', 'occupied'])
  })

  test('13 — without confirmTableReset, no table is reset', async () => {
    const store = await mkStore('OPEN_NO_CONFIRM')
    const eligible = await mkTable(store.id, 'eligible', 'occupied')

    const res = await request(app)
      .post('/cash-register/open')
      .send({ store: store.id, openingBalance: 100000 })
      .set('Authorization', `Bearer ${tokenFor(store.id)}`)

    expect(res.status).toBe(201)
    createdRegisterIds.push(res.body.data.id)
    expect(res.body.tableCleanupResult).toEqual({
      attempted: false,
      succeeded: 0,
      failed: 0
    })

    const eligibleAfter = await db.table.findByPk(eligible.id)
    expect(eligibleAfter.status).toBe('occupied')
  })

  test('14 — the existing "store already has an open register" guard is unaffected', async () => {
    const store = await mkStore('OPEN_GUARD_INTACT')
    const eligible = await mkTable(store.id, 'eligible', 'occupied')
    const token = tokenFor(store.id)

    const first = await request(app)
      .post('/cash-register/open')
      .send({ store: store.id, openingBalance: 100000 })
      .set('Authorization', `Bearer ${token}`)
    expect(first.status).toBe(201)
    createdRegisterIds.push(first.body.data.id)

    const second = await request(app)
      .post('/cash-register/open')
      .send({ store: store.id, openingBalance: 100000, confirmTableReset: true })
      .set('Authorization', `Bearer ${token}`)

    expect([400, 409]).toContain(second.status)
    expect(second.body.message).toMatch(/already has an open cash register/i)
    expect(second.body.tableCleanupResult).toBeUndefined()

    // The guard rejected the second request before cleanup could ever run.
    const eligibleAfter = await db.table.findByPk(eligible.id)
    expect(eligibleAfter.status).toBe('occupied')
  })
})
