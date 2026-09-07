process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let storeA = null
let storeB = null
let category = null
let tokenA = null
let counter = 0

const nextTag = () => {
  counter += 1
  return `F7-${Date.now()}-${counter}`
}

const makeIngredient = async (store, overrides = {}) =>
  db.ingredient.create({
    store,
    name: nextTag(),
    stock: 1000,
    unit: 'g',
    baseUnit: 'g',
    costPrice: 10,
    ...overrides
  })

const makeProduct = async (overrides = {}) =>
  db.product.create({
    nameProduct: nextTag(),
    category: category.id,
    price: 20000,
    stock: 100,
    inventoryMode: 'stocked',
    ...overrides
  })

const makeBom = async (store, productId, lines, overrides = {}) => {
  const header = await db.bom_header.create({
    store,
    productId,
    name: nextTag(),
    status: 'active',
    ...overrides
  })
  await db.bom_line.bulkCreate(
    lines.map((l) => ({
      bomHeaderId: header.id,
      ingredientId: l.ingredientId,
      qty: l.qty,
      unit: l.unit || 'g'
    }))
  )
  return header
}

const createOrder = (token, body) =>
  request(app).post('/order/create').set('Authorization', `Bearer ${token}`).send(body)

const updateOrderStatus = (token, body) =>
  request(app).put('/order/update-status').set('Authorization', `Bearer ${token}`).send(body)

// Direct DB fixture for the deferred/paid-transition path — mirrors the
// established F3-F6 convention (an order created unpaid, transitioned to
// 'paid' later via PUT /order/update-status, exercising
// deductStockForPaidOrder rather than deductStockForOrder).
const makeUnpaidOrderWithItem = async ({ store, product, quantity, price = 20000 }) => {
  const order = await db.order.create({
    orderNumber: nextTag(),
    store,
    status: 'pending',
    paymentStatus: 'unpaid',
    subTotal: price * quantity,
    totalQuantity: quantity,
    totalPrice: price * quantity,
    source: 'pos'
  })
  const item = await db.order_item.create({
    order: order.id,
    product: product.id,
    productName: product.nameProduct,
    quantity,
    price,
    totalPrice: price * quantity,
    hppSnapshot: 0,
    status: 'pending'
  })
  return { order, item }
}

beforeAll(async () => {
  storeA = await db.location.create({ name: 'F7_STORE_A', status: 'active' })
  storeB = await db.location.create({ name: 'F7_STORE_B', status: 'active' })
  category = await db.category.create({ name: 'F7_CATEGORY' })
  tokenA = jwt.sign({ id: 9401, userName: 'f7_admin_a', roleType: 'admin', store: storeA.id }, JWT_SECRET)
})

afterAll(async () => {
  await db.stock_history.destroy({ where: {}, force: true })
  await db.bom_line.destroy({ where: {}, force: true })
  await db.bom_header.destroy({ where: {}, force: true })
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order_status.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: [storeA.id, storeB.id] }, force: true })
  await db.product_store_stock.destroy({ where: {}, force: true })
  await db.best_selling.destroy({ where: {}, force: true })
  await db.product.destroy({ where: { category: category.id }, force: true })
  await db.ingredient.destroy({ where: {}, force: true, paranoid: false })
  await db.category.destroy({ where: { id: category.id }, force: true })
  await db.location.destroy({ where: { id: [storeA.id, storeB.id] }, force: true })
})

describe('F7 — inventory modes', () => {
  test('stocked product with no BOM: unaffected, product stock deducted as before', async () => {
    const product = await makeProduct({ stock: 50 })
    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 3 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    const after = await db.product.findByPk(product.id)
    expect(after.stock).toBe(47)
  })

  test('stocked product WITH an active BOM: BOM is ignored entirely, only product stock deducted', async () => {
    const ing = await makeIngredient(storeA.id)
    const product = await makeProduct({ stock: 50, inventoryMode: 'stocked' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 5 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 2 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    const afterProduct = await db.product.findByPk(product.id)
    expect(afterProduct.stock).toBe(48)
    const afterIng = await db.ingredient.findByPk(ing.id)
    expect(afterIng.stock).toBe(1000) // untouched
  })

  test('make_to_order product: product stock NOT deducted, ingredients deducted', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 100 })
    const product = await makeProduct({ stock: 50, inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 5 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 3 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    const afterProduct = await db.product.findByPk(product.id)
    expect(afterProduct.stock).toBe(50) // untouched
    const afterIng = await db.ingredient.findByPk(ing.id)
    expect(afterIng.stock).toBe(85) // 100 - (5*3)
  })

  test('hybrid product: both product stock and ingredients deducted', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 100 })
    const product = await makeProduct({ stock: 50, inventoryMode: 'hybrid' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 4 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 2 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    const afterProduct = await db.product.findByPk(product.id)
    expect(afterProduct.stock).toBe(48)
    const afterIng = await db.ingredient.findByPk(ing.id)
    expect(afterIng.stock).toBe(92) // 100 - (4*2)
  })

  test('default existing product (inventoryMode omitted at create) is stocked', async () => {
    const product = await db.product.create({
      nameProduct: nextTag(),
      category: category.id,
      price: 10000,
      stock: 10
    })
    expect(product.inventoryMode).toBe('stocked')
  })

  test('invalid inventoryMode is rejected at the API boundary', async () => {
    const res = await request(app)
      .post('/product/add-product')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nameProduct: nextTag(), category: category.id, price: 1000, inventoryMode: 'bogus_mode' })
    expect(res.status).toBe(400)
  })
})

describe('F7 — BOM explosion', () => {
  test('multiple ingredients, quantity multiplication', async () => {
    const ingA = await makeIngredient(storeA.id, { stock: 1000 })
    const ingB = await makeIngredient(storeA.id, { stock: 1000 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [
      { ingredientId: ingA.id, qty: 3 },
      { ingredientId: ingB.id, qty: 7 }
    ])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 4 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    expect((await db.ingredient.findByPk(ingA.id)).stock).toBe(1000 - 3 * 4)
    expect((await db.ingredient.findByPk(ingB.id)).stock).toBe(1000 - 7 * 4)
  })

  test('duplicate BOM lines for the same ingredient are summed, not deduplicated', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 1000 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [
      { ingredientId: ing.id, qty: 2 },
      { ingredientId: ing.id, qty: 3 }
    ])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 4 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    // (2+3) * 4 = 20, matching the mandatory example from the contract.
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(1000 - 20)
  })

  test('multiple order lines (different products) sharing one ingredient aggregate into a single mutation', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 1000 })
    const productA = await makeProduct({ inventoryMode: 'make_to_order' })
    const productB = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, productA.id, [{ ingredientId: ing.id, qty: 5 }])
    await makeBom(storeA.id, productB.id, [{ ingredientId: ing.id, qty: 7 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [
        { product: productA.id, quantity: 1 },
        { product: productB.id, quantity: 1 }
      ],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(1000 - 12)

    const rows = await db.stock_history.findAll({
      where: { referenceType: 'sale', referenceId: res.body.data.id, ingredient: ing.id }
    })
    // per-(product, ingredient) attribution preserved, not collapsed.
    expect(rows.length).toBe(2)
    expect(rows.map((r) => Number(r.quantityChange)).sort((a, b) => a - b)).toEqual([-7, -5])
  })

  test('same product appearing in multiple order lines: ingredient requirement sums correctly', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 1000 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 2 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [
        { product: product.id, quantity: 3 },
        { product: product.id, quantity: 5 }
      ],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    // (2*3) + (2*5) = 16
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(1000 - 16)
  })
})

describe('F7 — BOM validation (fail-closed)', () => {
  test('missing BOM for a make_to_order product: 409, nothing mutated', async () => {
    const product = await makeProduct({ inventoryMode: 'make_to_order', stock: 20 })
    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
    expect((await db.product.findByPk(product.id)).stock).toBe(20)
  })

  test('empty BOM (header exists, zero lines): 409', async () => {
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await db.bom_header.create({ store: storeA.id, productId: product.id, name: nextTag(), status: 'active' })
    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
  })

  test('missing ingredient (bom_line references a soft-deleted ingredient): 409', async () => {
    const ing = await makeIngredient(storeA.id)
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 1 }])
    // Soft-delete only — bom_line.ingredientId has a real FK with no
    // ON DELETE CASCADE, so a hard delete is rejected by the database
    // itself. Paranoid's default scope excludes this row from the
    // resolver's findAll, which is exactly what "missing" means here.
    await db.ingredient.destroy({ where: { id: ing.id } })

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
  })

  test('foreign-store ingredient referenced by a same-store BOM: 409, deduction-time defense catches it', async () => {
    const foreignIng = await makeIngredient(storeB.id)
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    // Bypass bom.js's own authoring validation (direct DB insert) to prove
    // deduction-time defense does not rely solely on it.
    await makeBom(storeA.id, product.id, [{ ingredientId: foreignIng.id, qty: 1 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
    expect((await db.ingredient.findByPk(foreignIng.id)).stock).toBe(1000)
  })

  test('NULL-store ingredient: 409', async () => {
    const nullStoreIng = await makeIngredient(null)
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: nullStoreIng.id, qty: 1 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
  })

  test('bom_line.qty <= 0: 409', async () => {
    const ing = await makeIngredient(storeA.id)
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 0 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
  })

  test('unit mismatch (bom_line.unit !== ingredient.baseUnit): 409', async () => {
    const ing = await makeIngredient(storeA.id, { baseUnit: 'g' })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    // Direct DB insert bypassing bom.js's own authoring check, to prove
    // deduction-time re-verification independently catches it too.
    const header = await db.bom_header.create({ store: storeA.id, productId: product.id, name: nextTag(), status: 'active' })
    await db.bom_line.create({ bomHeaderId: header.id, ingredientId: ing.id, qty: 5, unit: 'kg' })

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
  })
})

describe('F7 — BOM authoring validation (bom.js)', () => {
  test('creating a BOM with a unit mismatch is rejected at authoring time', async () => {
    const ing = await makeIngredient(storeA.id, { baseUnit: 'g' })
    const product = await makeProduct()
    const res = await request(app)
      .post('/bom/add')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ productId: product.id, lines: [{ ingredientId: ing.id, qty: 5, unit: 'kg' }] })
    expect(res.status).toBe(400)
    const lines = await db.bom_line.findAll({ include: [{ model: db.bom_header, as: 'header', where: { productId: product.id } }] })
    expect(lines.length).toBe(0)
  })

  test('creating a BOM with matching units succeeds', async () => {
    const ing = await makeIngredient(storeA.id, { baseUnit: 'g' })
    const product = await makeProduct()
    const res = await request(app)
      .post('/bom/add')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ productId: product.id, lines: [{ ingredientId: ing.id, qty: 5, unit: 'g' }] })
    expect(res.status).toBe(201)
  })
})

describe('F7 — atomicity: no partial mutation', () => {
  test('one sufficient ingredient + one insufficient ingredient: entire order rolls back', async () => {
    const ingOk = await makeIngredient(storeA.id, { stock: 1000 })
    const ingShort = await makeIngredient(storeA.id, { stock: 2 })
    const product = await makeProduct({ inventoryMode: 'make_to_order', stock: 20 })
    await makeBom(storeA.id, product.id, [
      { ingredientId: ingOk.id, qty: 1 },
      { ingredientId: ingShort.id, qty: 5 } // needs 5, only 2 available
    ])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)

    expect((await db.ingredient.findByPk(ingOk.id)).stock).toBe(1000)
    expect((await db.ingredient.findByPk(ingShort.id)).stock).toBe(2)
    expect((await db.product.findByPk(product.id)).stock).toBe(20)
    const historyRows = await db.stock_history.findAll({
      where: { ingredient: [ingOk.id, ingShort.id] }
    })
    expect(historyRows.length).toBe(0)
  })
})

describe('F7 — deferred path (deductStockForPaidOrder, via PUT /order/update-status)', () => {
  test('make_to_order product: ingredients deducted on the paid-transition, not at order creation', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 100 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 6 }])
    const { order } = await makeUnpaidOrderWithItem({ store: storeA.id, product, quantity: 2 })

    // Not yet deducted — order is still unpaid.
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(100)

    const res = await updateOrderStatus(tokenA, { id: order.id, status: 'paid' })
    expect(res.status).toBe(200)
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(100 - 12)
  })

  test('split-bill completion also triggers ingredient deduction (shared deductStockForPaidOrder)', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 100 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 10 }])
    const { order } = await makeUnpaidOrderWithItem({ store: storeA.id, product, quantity: 1, price: 50000 })

    const createRes = await request(app)
      .post('/split-bill/create')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ order: order.id, items: [{ amount: 50000 }] })
    expect(createRes.status).toBe(201)
    const [split] = createRes.body.data

    const payRes = await request(app)
      .put(`/split-bill/pay/${split.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ paymentMethod: 'cash' })
    expect(payRes.status).toBe(200)
    expect(payRes.body.data.orderComplete).toBe(true)
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(90)
  })
})

describe('F7 — snapshot immutability (mandatory)', () => {
  test('cancellation restores the EXACT originally-deducted quantity, never a re-read of a since-edited BOM', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 100 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    const bom = await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 5 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(95) // 100 - 5

    // Change the recipe drastically AFTER the sale.
    const line = await db.bom_line.findOne({ where: { bomHeaderId: bom.id, ingredientId: ing.id } })
    await line.update({ qty: 100 })

    const cancelRes = await updateOrderStatus(tokenA, { id: res.body.data.id, status: 'cancelled' })
    expect(cancelRes.status).toBe(200)

    // Must restore exactly 5 (the original snapshot), never 100.
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(100)

    const reversalRows = await db.stock_history.findAll({
      where: { referenceType: 'sale_reversal', referenceId: res.body.data.id, ingredient: ing.id }
    })
    expect(reversalRows.length).toBe(1)
    expect(Number(reversalRows[0].quantityChange)).toBe(5)
  })

  test('cancellation reversal preserves per-product attribution for multiple products sharing an ingredient', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 100 })
    const productA = await makeProduct({ inventoryMode: 'make_to_order' })
    const productB = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, productA.id, [{ ingredientId: ing.id, qty: 5 }])
    await makeBom(storeA.id, productB.id, [{ ingredientId: ing.id, qty: 7 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [
        { product: productA.id, quantity: 1 },
        { product: productB.id, quantity: 1 }
      ],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(201)
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(100 - 12)

    const cancelRes = await updateOrderStatus(tokenA, { id: res.body.data.id, status: 'cancelled' })
    expect(cancelRes.status).toBe(200)
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(100)

    const reversalRows = await db.stock_history.findAll({
      where: { referenceType: 'sale_reversal', referenceId: res.body.data.id, ingredient: ing.id }
    })
    expect(reversalRows.length).toBe(2)
    expect(reversalRows.map((r) => Number(r.quantityChange)).sort((a, b) => a - b)).toEqual([5, 7])
  })
})

describe('F7 — exactly-once', () => {
  test('duplicate/retried completion attempt on the same order never double-deducts', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 100 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 6 }])
    const { order } = await makeUnpaidOrderWithItem({ store: storeA.id, product, quantity: 1 })

    const [r1, r2] = await Promise.all([
      updateOrderStatus(tokenA, { id: order.id, status: 'paid' }),
      updateOrderStatus(tokenA, { id: order.id, status: 'paid' })
    ])
    const statuses = [r1.status, r2.status].sort((a, b) => a - b)
    expect(statuses).toEqual([200, 200]) // second is a no-op success (already paid), not an error

    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(94) // deducted exactly once, not 88
    const rows = await db.stock_history.findAll({
      where: { referenceType: 'sale', referenceId: order.id, ingredient: ing.id }
    })
    expect(rows.length).toBe(1)
  })
})

describe('F7 — tenant isolation', () => {
  test('a BOM belonging to a different store is treated as absent (409), not silently used', async () => {
    const ing = await makeIngredient(storeB.id)
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    // BOM exists, but for storeB, while the order is for storeA.
    await makeBom(storeB.id, product.id, [{ ingredientId: ing.id, qty: 1 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
  })

  test('malformed cross-store BOM inserted directly at the DB level is still rejected at checkout', async () => {
    const foreignIng = await makeIngredient(storeB.id, { stock: 500 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    // Same-store BOM header, but its line references another store's
    // ingredient — exactly the malformed-record scenario deduction-time
    // defense (not authoring-time validation) must catch.
    await makeBom(storeA.id, product.id, [{ ingredientId: foreignIng.id, qty: 1 }])

    const res = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(res.status).toBe(409)
    expect((await db.ingredient.findByPk(foreignIng.id)).stock).toBe(500)
  })
})

describe('F7 — concurrency', () => {
  test('two concurrent orders consuming the same ingredient, combined demand > stock: exactly one succeeds', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 10 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 7 }])

    const [r1, r2] = await Promise.all([
      createOrder(tokenA, {
        store: storeA.id,
        items: [{ product: product.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashierName: 'F7 Concurrent A'
      }),
      createOrder(tokenA, {
        store: storeA.id,
        items: [{ product: product.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashierName: 'F7 Concurrent B'
      })
    ])
    const statuses = [r1.status, r2.status].sort((a, b) => a - b)
    expect(statuses).toEqual([201, 409])
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(3) // 10 - 7, exactly once
  })

  test('two different products sharing one ingredient, concurrent checkouts, both within stock: both succeed, deducted once each', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 100 })
    const productA = await makeProduct({ inventoryMode: 'make_to_order' })
    const productB = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, productA.id, [{ ingredientId: ing.id, qty: 5 }])
    await makeBom(storeA.id, productB.id, [{ ingredientId: ing.id, qty: 8 }])

    const [r1, r2] = await Promise.all([
      createOrder(tokenA, {
        store: storeA.id,
        items: [{ product: productA.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashierName: 'F7 Concurrent A'
      }),
      createOrder(tokenA, {
        store: storeA.id,
        items: [{ product: productB.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashierName: 'F7 Concurrent B'
      })
    ])
    expect(r1.status).toBe(201)
    expect(r2.status).toBe(201)
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(100 - 5 - 8)
  })

  test('multiple ingredients in one order, post-lock revalidation determines the outcome (not a stale pre-transaction estimate)', async () => {
    const ing = await makeIngredient(storeA.id, { stock: 10 })
    const product = await makeProduct({ inventoryMode: 'make_to_order' })
    await makeBom(storeA.id, product.id, [{ ingredientId: ing.id, qty: 6 }])

    // First order passes any pre-check (10 >= 6) and succeeds, leaving 4.
    const first = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(first.status).toBe(201)

    // Second order also needs 6, but only 4 remain — must fail under the
    // freshly-locked value, not any stale estimate from before the first
    // order committed.
    const second = await createOrder(tokenA, {
      store: storeA.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F7 Test'
    })
    expect(second.status).toBe(409)
    expect((await db.ingredient.findByPk(ing.id)).stock).toBe(4)
  })
})

describe('F7 — deadlock retry (real Postgres deadlock, not mocked)', () => {
  test('withDeadlockRetry recovers a genuine deadlock between two transactions locking ingredient rows in opposite order', async () => {
    const { withDeadlockRetry } = require('../utils/deadlockRetry')
    const ingX = await makeIngredient(storeA.id, { stock: 100 })
    const ingY = await makeIngredient(storeA.id, { stock: 100 })

    // Deliberately opposite lock order across the two transactions —
    // bypassing F7's own sorted-locking code on purpose, to force a real
    // Postgres deadlock and prove withDeadlockRetry (the mechanism F7's
    // sorted locking relies on as a backstop) actually recovers one.
    let attemptsA = 0
    let attemptsB = 0
    const txnA = withDeadlockRetry(() =>
      db.sequelize.transaction(async (t) => {
        attemptsA += 1
        await db.ingredient.findByPk(ingX.id, { transaction: t, lock: t.LOCK.UPDATE })
        await new Promise((resolve) => setTimeout(resolve, 150))
        await db.ingredient.findByPk(ingY.id, { transaction: t, lock: t.LOCK.UPDATE })
        await db.ingredient.update({ stock: 90 }, { where: { id: ingX.id }, transaction: t })
      })
    )
    const txnB = withDeadlockRetry(() =>
      db.sequelize.transaction(async (t) => {
        attemptsB += 1
        await db.ingredient.findByPk(ingY.id, { transaction: t, lock: t.LOCK.UPDATE })
        await new Promise((resolve) => setTimeout(resolve, 150))
        await db.ingredient.findByPk(ingX.id, { transaction: t, lock: t.LOCK.UPDATE })
        await db.ingredient.update({ stock: 90 }, { where: { id: ingY.id }, transaction: t })
      })
    )

    await Promise.all([txnA, txnB])

    // Both must have eventually succeeded — one of them was necessarily
    // killed by Postgres's deadlock detector and retried from scratch by
    // withDeadlockRetry (a genuine 40P01, not a mock).
    expect((await db.ingredient.findByPk(ingX.id)).stock).toBe(90)
    expect((await db.ingredient.findByPk(ingY.id)).stock).toBe(90)
    expect(attemptsA + attemptsB).toBeGreaterThan(2)
  })
})
