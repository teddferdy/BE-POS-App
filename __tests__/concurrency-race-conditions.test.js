process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')
const { Op } = require('sequelize')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Regression tests for the concurrency audit: these fire genuinely
// concurrent requests (Promise.all against the same in-process app, real
// HTTP round trips through supertest, real Postgres transactions) at the
// same row, rather than testing sequentially and assuming correctness.

describe('Concurrent checkout — overselling (order.js createOrder)', () => {
  let location, category, product, token

  beforeAll(async () => {
    location = await db.location.create({ name: 'RACE_STORE', status: 'active' })
    category = await db.category.create({ name: 'RACE_CATEGORY' })
    product = await db.product.create({
      nameProduct: 'RACE_PRODUCT_LAST_UNIT',
      category: category.id,
      price: 10000,
      stock: 1 // exactly one unit — the classic "two cashiers, one item" scenario
    })
    token = jwt.sign(
      { id: 8801, userName: 'race_cashier', roleType: 'kasir', store: location.id },
      JWT_SECRET
    )
  })

  afterAll(async () => {
    await db.order_item.destroy({ where: {}, force: true })
    await db.transaction.destroy({ where: {}, force: true })
    await db.order_status.destroy({ where: {}, force: true })
    await db.order.destroy({ where: { store: location.id }, force: true })
    await db.best_selling.destroy({ where: { productId: product.id }, force: true })
    await db.stock_history.destroy({ where: { product: product.id }, force: true })
    await db.product_store_stock.destroy({ where: { product: product.id }, force: true })
    await db.product.destroy({ where: { id: product.id }, force: true })
    await db.category.destroy({ where: { id: category.id }, force: true })
    await db.location.destroy({ where: { id: location.id }, force: true })
  })

  test('two simultaneous orders for the last unit — exactly one succeeds, stock never goes negative or oversold', async () => {
    const makeOrderRequest = () =>
      request(app)
        .post('/order/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          store: location.id,
          items: [{ product: product.id, quantity: 1 }],
          paymentMethod: 'cash',
          cashierName: 'Race Cashier'
        })

    // Fired together, not awaited sequentially — both requests are in
    // flight at the same time, racing for the same row.
    const [resA, resB] = await Promise.all([makeOrderRequest(), makeOrderRequest()])

    const statuses = [resA.status, resB.status].sort()
    // Exactly one must succeed (201) and the other must be rejected (400) —
    // NOT both 201 (overselling) and NOT both 400 (false rejection).
    expect(statuses).toEqual([201, 400])

    const finalProduct = await db.product.findByPk(product.id)
    expect(finalProduct.stock).toBe(0) // never negative, never left at 1 (double-success) either

    const paidOrders = await db.order.count({
      where: { store: location.id, status: 'paid' }
    })
    expect(paidOrders).toBe(1) // only one sale actually happened
  })
})

describe('Concurrent status update — double stock deduction (order.js updateOrderStatus)', () => {
  let location, category, product, order, token

  beforeAll(async () => {
    location = await db.location.create({ name: 'RACE_STATUS_STORE', status: 'active' })
    category = await db.category.create({ name: 'RACE_STATUS_CATEGORY' })
    product = await db.product.create({
      nameProduct: 'RACE_STATUS_PRODUCT',
      category: category.id,
      price: 5000,
      stock: 10
    })
    token = jwt.sign(
      { id: 8802, userName: 'race_status_cashier', roleType: 'kasir', store: location.id },
      JWT_SECRET
    )

    // Bypass the API to create an order sitting in a not-yet-paid state —
    // createOrder always marks orders paid immediately, so the only way to
    // reach the "transition pending -> paid" code path (where the double-
    // deduction bug lived) is to seed one directly, mirroring a pay-later
    // order that a cashier later marks as paid.
    order = await db.order.create({
      orderNumber: `RACE-STATUS-${Date.now()}`,
      store: location.id,
      status: 'pending',
      paymentStatus: 'unpaid',
      totalPrice: 15000,
      paymentMethod: 'cash'
    })
    await db.order_item.create({
      order: order.id,
      product: product.id,
      quantity: 3,
      price: 5000
    })
  })

  afterAll(async () => {
    await db.order_item.destroy({ where: { order: order.id }, force: true })
    await db.transaction.destroy({ where: { order: order.id }, force: true })
    await db.order_status.destroy({ where: { order: order.id }, force: true })
    await db.order.destroy({ where: { id: order.id }, force: true })
    await db.best_selling.destroy({ where: { productId: product.id }, force: true })
    await db.stock_history.destroy({ where: { product: product.id }, force: true })
    await db.product_store_stock.destroy({ where: { product: product.id }, force: true })
    await db.product.destroy({ where: { id: product.id }, force: true })
    await db.category.destroy({ where: { id: category.id }, force: true })
    await db.location.destroy({ where: { id: location.id }, force: true })
  })

  test('two simultaneous "mark as paid" requests deduct stock exactly once', async () => {
    const markPaid = () =>
      request(app)
        .put('/order/update-status')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: order.id, status: 'paid', store: location.id })

    await Promise.all([markPaid(), markPaid()])

    const finalProduct = await db.product.findByPk(product.id)
    expect(finalProduct.stock).toBe(7) // 10 - 3, deducted once, not 4 (10 - 3 - 3)

    const payments = await db.transaction.count({ where: { order: order.id } })
    expect(payments).toBe(1)

    const saleHistoryCount = await db.stock_history.count({
      where: { product: product.id, referenceType: 'sale' }
    })
    expect(saleHistoryCount).toBe(1)
  })
})

describe('Concurrent PO receiving — lost update on product.stock (purchaseOrder.js receive)', () => {
  let location, category, product, poA, poB, poItemA, poItemB, token

  beforeAll(async () => {
    location = await db.location.create({ name: 'RACE_PO_STORE', status: 'active' })
    category = await db.category.create({ name: 'RACE_PO_CATEGORY' })
    product = await db.product.create({
      nameProduct: 'RACE_PO_PRODUCT',
      category: category.id,
      price: 7000,
      costPrice: 4000,
      stock: 0
    })
    token = jwt.sign(
      { id: 8803, userName: 'race_po_admin', roleType: 'admin', store: location.id },
      JWT_SECRET
    )

    const createRes = (qty) =>
      request(app)
        .post('/purchase-order/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          store: location.id,
          status: 'ordered',
          items: [{ product: product.id, quantity: qty, price: 4000 }]
        })

    const [resA, resB] = await Promise.all([createRes(5), createRes(3)])
    poA = resA.body.data
    poB = resB.body.data
    poItemA = poA.items[0]
    poItemB = poB.items[0]
  })

  afterAll(async () => {
    await db.product_batch_stock.destroy({ where: {}, force: true })
    await db.product_batch.destroy({ where: { product: product.id }, force: true })
    await db.stock_history.destroy({ where: { product: product.id }, force: true })
    await db.product_store_stock.destroy({ where: { product: product.id }, force: true })
    await db.purchase_order_item.destroy({ where: {}, force: true })
    await db.purchase_order.destroy({ where: { store: location.id }, force: true })
    await db.product.destroy({ where: { id: product.id }, force: true })
    await db.category.destroy({ where: { id: category.id }, force: true })
    await db.location.destroy({ where: { id: location.id }, force: true })
  })

  test('two purchase orders for the same product received at the same time — both increments land, none lost', async () => {
    const receive = (poId, itemId, product_id, qty) =>
      request(app)
        .put(`/purchase-order/receive/${poId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ id: itemId, product: product_id, receivedQuantity: qty }] })

    const [resA, resB] = await Promise.all([
      receive(poA.id, poItemA.id, product.id, 5),
      receive(poB.id, poItemB.id, product.id, 3)
    ])

    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)

    const finalProduct = await db.product.findByPk(product.id)
    // Started at 0; both receipts (+5 and +3) must both land — 8, not 5 or 3
    // (which is what the pre-fix plain-JS `product.stock + receiveQty` race
    // would silently produce).
    expect(finalProduct.stock).toBe(8)
  })
})

describe('Concurrent duplicate submit — idempotency key (order.js createOrder)', () => {
  let location, category, product, token

  beforeAll(async () => {
    location = await db.location.create({ name: 'RACE_IDEMPOTENCY_STORE', status: 'active' })
    category = await db.category.create({ name: 'RACE_IDEMPOTENCY_CATEGORY' })
    product = await db.product.create({
      nameProduct: 'RACE_IDEMPOTENCY_PRODUCT',
      category: category.id,
      price: 12000,
      stock: 50
    })
    // getEffectiveStock() prefers a product_store_stock row over base
    // product.stock once one exists, and that row is lazily created
    // starting at 0 on first deduction — seed it to match, mirroring a
    // store that's already been through stock opname/goods receipt.
    await db.product_store_stock.create({
      product: product.id,
      store: location.id,
      stock: product.stock
    })
    token = jwt.sign(
      { id: 8804, userName: 'race_idempotency_cashier', roleType: 'kasir', store: location.id },
      JWT_SECRET
    )
  })

  afterAll(async () => {
    await db.order_item.destroy({ where: {}, force: true })
    await db.transaction.destroy({ where: {}, force: true })
    await db.order_status.destroy({ where: {}, force: true })
    await db.order.destroy({ where: { store: location.id }, force: true })
    await db.best_selling.destroy({ where: { productId: product.id }, force: true })
    await db.stock_history.destroy({ where: { product: product.id }, force: true })
    await db.product_store_stock.destroy({ where: { product: product.id }, force: true })
    await db.product.destroy({ where: { id: product.id }, force: true })
    await db.category.destroy({ where: { id: category.id }, force: true })
    await db.location.destroy({ where: { id: location.id }, force: true })
  })

  test('two simultaneous submits with the same idempotency key create exactly one order', async () => {
    const idempotencyKey = `race-key-${Date.now()}`
    const submit = () =>
      request(app)
        .post('/order/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          store: location.id,
          items: [{ product: product.id, quantity: 2 }],
          paymentMethod: 'cash',
          cashierName: 'Race Cashier',
          idempotencyKey
        })

    const [resA, resB] = await Promise.all([submit(), submit()])

    // One of the two is the "fresh create" (201), the other is the replay
    // (200) — either the fast-path findOne caught it, or the unique-index
    // violation fallback did. Both must reference the SAME order id.
    expect([resA.status, resB.status].sort()).toEqual([200, 201])
    expect(resA.body.data.id).toBe(resB.body.data.id)

    const orderCount = await db.order.count({
      where: { store: location.id, idempotencyKey }
    })
    expect(orderCount).toBe(1)

    // Stock must only have been deducted once, not twice.
    const finalProduct = await db.product.findByPk(product.id)
    expect(finalProduct.stock).toBe(48) // 50 - 2, not 46 (50 - 2 - 2)
  })

  test('a retried submit after the first request completes also replays the same order', async () => {
    const idempotencyKey = `race-key-sequential-${Date.now()}`
    const send = () =>
      request(app)
        .post('/order/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          store: location.id,
          items: [{ product: product.id, quantity: 1 }],
          paymentMethod: 'cash',
          cashierName: 'Race Cashier',
          idempotencyKey
        })

    const first = await send()
    expect(first.status).toBe(201)

    const retry = await send()
    expect(retry.status).toBe(200)
    expect(retry.body.data.id).toBe(first.body.data.id)

    const orderCount = await db.order.count({
      where: { store: location.id, idempotencyKey }
    })
    expect(orderCount).toBe(1)
  })
})

describe('Concurrent order creation — daily customer number uniqueness (order.js generateCustomerNumber)', () => {
  let location, category, product, token

  beforeAll(async () => {
    location = await db.location.create({ name: 'RACE_CUSTNUM_STORE', status: 'active' })
    category = await db.category.create({ name: 'RACE_CUSTNUM_CATEGORY' })
    product = await db.product.create({
      nameProduct: 'RACE_CUSTNUM_PRODUCT',
      category: category.id,
      price: 3000,
      stock: 100
    })
    // See the note in the idempotency describe block above — seed
    // product_store_stock so 10 concurrent orders against one product
    // don't see a lazily-created, zero-baseline row as "out of stock".
    await db.product_store_stock.create({
      product: product.id,
      store: location.id,
      stock: product.stock
    })
    token = jwt.sign(
      { id: 8805, userName: 'race_custnum_cashier', roleType: 'kasir', store: location.id },
      JWT_SECRET
    )
  })

  afterAll(async () => {
    await db.order_item.destroy({ where: {}, force: true })
    await db.transaction.destroy({ where: {}, force: true })
    await db.order_status.destroy({ where: {}, force: true })
    await db.order.destroy({ where: { store: location.id }, force: true })
    await db.best_selling.destroy({ where: { productId: product.id }, force: true })
    await db.stock_history.destroy({ where: { product: product.id }, force: true })
    await db.product_store_stock.destroy({ where: { product: product.id }, force: true })
    await db.product.destroy({ where: { id: product.id }, force: true })
    await db.category.destroy({ where: { id: category.id }, force: true })
    await db.location.destroy({ where: { id: location.id }, force: true })
  }, 30000)

  test(
    '10 simultaneous orders at the same store never receive a duplicate customer number',
    async () => {
      const submit = () =>
        request(app)
          .post('/order/create')
          .set('Authorization', `Bearer ${token}`)
          .send({
            store: location.id,
            items: [{ product: product.id, quantity: 1 }],
            paymentMethod: 'cash',
            cashierName: 'Race Cashier'
          })

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => submit())
      )

      expect(responses.every((r) => r.status === 201)).toBe(true)

      const customerNumbers = responses.map((r) => r.body.data.customerNumber)
      const uniqueNumbers = new Set(customerNumbers)
      // The old MAX(customerNumber)+1 pattern (no lock, no unique constraint)
      // could hand out the same number to two concurrent orders — with 10
      // genuinely concurrent requests this reliably reproduced a collision.
      expect(uniqueNumbers.size).toBe(customerNumbers.length)
    },
    30000 // 10 genuinely concurrent order-creation transactions serialize
    // on the shared per-store daily counter row (and the shared product
    // row's lock) — well past Jest's 5s default for a real, unmocked
    // concurrency test.
  )
})

// PHASE 19 BATCH 3B: permanent regression coverage for the two concurrency
// scenarios previously verified only as one-off audit evidence (BATCH 2B-1
// concurrent cancellation, BATCH 2C-2 refund/return consistency). Both
// exercise the real HTTP routes, real Postgres transactions and row locks —
// nothing here is mocked.

describe('Concurrent paid-order cancellation — refund and stock restoration happen exactly once (order.js updateOrderStatus)', () => {
  let location, category, product, token, order

  beforeAll(async () => {
    location = await db.location.create({ name: 'RACE_CANCEL_STORE', status: 'active' })
    category = await db.category.create({ name: 'RACE_CANCEL_CATEGORY' })
    product = await db.product.create({
      nameProduct: 'RACE_CANCEL_PRODUCT',
      category: category.id,
      price: 10000,
      stock: 10
    })
    token = jwt.sign(
      { id: 8806, userName: 'race_cancel_admin', roleType: 'admin', store: location.id },
      JWT_SECRET
    )

    const createRes = await request(app)
      .post('/order/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store: location.id,
        items: [{ product: product.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashierName: 'Race Cancel Admin'
      })
    expect(createRes.status).toBe(201)
    order = createRes.body.data

    const afterCreate = await db.product.findByPk(product.id)
    expect(afterCreate.stock).toBe(9)
  })

  afterAll(async () => {
    await db.order_status.destroy({ where: {}, force: true })
    await db.order_item.destroy({ where: {}, force: true })
    await db.transaction.destroy({ where: {}, force: true })
    await db.stock_history.destroy({ where: { product: product.id }, force: true })
    await db.order.destroy({ where: { store: location.id }, force: true })
    await db.best_selling.destroy({ where: { productId: product.id }, force: true })
    await db.product_store_stock.destroy({ where: { product: product.id }, force: true })
    await db.product.destroy({ where: { id: product.id }, force: true })
    await db.category.destroy({ where: { id: category.id }, force: true })
    await db.location.destroy({ where: { id: location.id }, force: true })
  })

  test('two simultaneous cancel requests for the same paid order produce exactly one refund and restore stock exactly once', async () => {
    const cancelOrder = () =>
      request(app)
        .put('/order/update-status')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: order.id, status: 'cancelled', store: location.id })

    // Genuinely concurrent — both in flight before either resolves, racing
    // on the same order row's lock inside updateOrderStatus's transaction.
    const [resA, resB] = await Promise.all([cancelOrder(), cancelOrder()])

    // Per the contract: the loser of the race may legally land on the
    // order's already-cancelled terminal state rather than erroring, so we
    // do not require a specific [200, xxx] pairing — only that neither
    // response is a server error, and that the cancellation actually
    // happened at least once.
    expect(resA.status).toBeLessThan(500)
    expect(resB.status).toBeLessThan(500)
    expect([resA.status, resB.status]).toContain(200)

    const finalOrder = await db.order.findByPk(order.id)
    expect(finalOrder.status).toBe('cancelled')
    expect(finalOrder.paymentStatus).toBe('refunded')

    // ONE cancellation -> ONE refund. A duplicate refund would show up as
    // two negative-amount transaction rows here.
    const refundTxns = await db.transaction.findAll({
      where: { order: order.id, amount: { [Op.lt]: 0 } }
    })
    expect(refundTxns.length).toBe(1)
    expect(Number(refundTxns[0].amount)).toBe(-Number(finalOrder.totalPrice))

    // ONE cancellation -> ONE stock restoration. 9 -> 10, never 11 (double
    // restore) and never left at 9 (no restore at all).
    const finalProduct = await db.product.findByPk(product.id)
    expect(finalProduct.stock).toBe(10)
    expect(finalProduct.stock).toBeGreaterThanOrEqual(0)

    const reversalHistoryCount = await db.stock_history.count({
      where: { product: product.id, referenceType: 'sale_reversal', referenceId: order.id }
    })
    expect(reversalHistoryCount).toBe(1)
  })
})

describe('Concurrent sales return of the same sold unit — return, refund and stock restoration happen exactly once (pos.js returnSalesOrder + salesReturn.js approve)', () => {
  let location, category, product, adminUser, token, order, orderItem

  beforeAll(async () => {
    location = await db.location.create({ name: 'RACE_RETURN_STORE', status: 'active' })
    category = await db.category.create({ name: 'RACE_RETURN_CATEGORY' })
    product = await db.product.create({
      nameProduct: 'RACE_RETURN_PRODUCT',
      category: category.id,
      price: 10000,
      stock: 10
    })
    // sales_return.createdBy has a real FK to user.id (unlike order.js's
    // createdBy/changedBy columns), so a JWT-only fabricated id 404s at
    // INSERT time with a SequelizeForeignKeyConstraintError — a real
    // db.user row is required here, matching sales-return-hardening.test.js's
    // own fixture convention.
    adminUser = await db.user.create({
      userName: 'race_return_admin',
      email: 'race_return_admin@test.com',
      roleType: 'admin',
      userType: 'admin',
      store: location.id,
      status: 'active'
    })
    token = jwt.sign(
      { id: adminUser.id, userName: adminUser.userName, roleType: 'admin', store: location.id },
      JWT_SECRET
    )

    const createRes = await request(app)
      .post('/order/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store: location.id,
        items: [{ product: product.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashierName: 'Race Return Admin'
      })
    expect(createRes.status).toBe(201)
    order = createRes.body.data
    orderItem = order.items[0]

    const afterCreate = await db.product.findByPk(product.id)
    expect(afterCreate.stock).toBe(9)
  })

  afterAll(async () => {
    await db.sales_return_item.destroy({ where: {}, force: true })
    await db.sales_return.destroy({ where: { order: order.id }, force: true })
    await db.order_status.destroy({ where: {}, force: true })
    await db.order_item.destroy({ where: {}, force: true })
    await db.transaction.destroy({ where: {}, force: true })
    await db.stock_history.destroy({ where: { product: product.id }, force: true })
    await db.order.destroy({ where: { store: location.id }, force: true })
    await db.best_selling.destroy({ where: { productId: product.id }, force: true })
    await db.product_store_stock.destroy({ where: { product: product.id }, force: true })
    await db.product.destroy({ where: { id: product.id }, force: true })
    await db.category.destroy({ where: { id: category.id }, force: true })
    await db.user.destroy({ where: { id: adminUser.id }, force: true })
    await db.location.destroy({ where: { id: location.id }, force: true })
  })

  test('two concurrent return attempts for the same single sold unit: exactly one is created, approved, refunded, and stock is restored exactly once', async () => {
    // Each "attempt" is the real end-to-end business operation (create,
    // then — only if creation actually reserved the unit — approve, which
    // is where returnSalesOrder/approve's own row locks execute the real
    // stock-restore and refund side effects). Both attempts are launched
    // together via Promise.all below, so both create() calls genuinely
    // race on the same order row's lock before either commits.
    const attemptReturn = async () => {
      const createRes = await request(app)
        .post(`/pos/order/${order.id}/return`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: product.id, orderItemId: orderItem.id, qty: 1 }],
          reason: 'concurrent return race'
        })
      if (createRes.status !== 201) {
        return { createRes, approveRes: null }
      }
      const approveRes = await request(app)
        .patch(`/sales-return/approve/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ id: createRes.body.data.id })
      return { createRes, approveRes }
    }

    const [flowA, flowB] = await Promise.all([attemptReturn(), attemptReturn()])

    // Only one unit was ever sold — create-time reservation (the locked
    // order re-read + returnedQtyMap check in returnSalesOrder, already
    // proven in sales-return-hardening.test.js's own concurrency suite)
    // must let exactly one of the two qty=1 requests through.
    const createStatuses = [flowA.createRes.status, flowB.createRes.status].sort(
      (a, b) => a - b
    )
    expect(createStatuses).toEqual([201, 409])

    const winner = flowA.createRes.status === 201 ? flowA : flowB
    expect(winner.approveRes.status).toBe(200)

    // ONE valid return — the 409'd attempt created zero rows.
    const returns = await db.sales_return.findAll({ where: { order: order.id } })
    expect(returns.length).toBe(1)
    expect(returns[0].status).toBe('approved')

    // ONE returned quantity, not two.
    const items = await db.sales_return_item.findAll({
      where: { salesReturn: returns[0].id }
    })
    const totalReturnedQty = items.reduce((s, i) => s + Number(i.qty), 0)
    expect(totalReturnedQty).toBe(1)

    // ONE refund transaction, for exactly the approved return's amount.
    const refundTxns = await db.transaction.findAll({
      where: { order: order.id, amount: { [Op.lt]: 0 } }
    })
    expect(refundTxns.length).toBe(1)
    expect(Number(refundTxns[0].amount)).toBe(-Number(returns[0].refundAmount))

    // ONE stock restoration: 9 -> 10, never 11 (double restore), never
    // negative.
    const finalProduct = await db.product.findByPk(product.id)
    expect(finalProduct.stock).toBe(10)
    expect(finalProduct.stock).toBeGreaterThanOrEqual(0)

    const restoreHistoryCount = await db.stock_history.count({
      where: {
        product: product.id,
        referenceType: 'sale_return',
        referenceId: returns[0].id
      }
    })
    expect(restoreHistoryCount).toBe(1)
  })
})
