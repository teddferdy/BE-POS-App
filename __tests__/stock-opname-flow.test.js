process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let location = null
let category = null
let product = null
let adminToken = null

beforeAll(async () => {
  location = await db.location.create({ name: 'OPNAME_FLOW_STORE', status: 'active' })
  category = await db.category.create({ name: 'OPNAME_FLOW_CATEGORY' })
  product = await db.product.create({
    nameProduct: 'OPNAME_FLOW_PRODUCT',
    category: category.id,
    price: 6000,
    stock: 20
  })
  adminToken = jwt.sign(
    { id: 7401, userName: 'admin_opname_flow', roleType: 'admin', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.stock_history.destroy({ where: { product: product?.id }, force: true })
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.stockOpnameItem.destroy({ where: {}, force: true })
  await db.stockOpname.destroy({ where: { store: location.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

describe('POST /stock-opname/create + PATCH /stock-opname/status/:id — reconciliation flow', () => {
  test('creating a draft opname does not touch stock yet', async () => {
    const res = await request(app)
      .post('/stock-opname/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        store: location.id,
        status: 'draft',
        items: [
          {
            product: product.id,
            namaBarang: product.nameProduct,
            stokAkhirJumlah: 20,
            stokFisikJumlah: 15,
            selisihJumlah: -5
          }
        ]
      })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('draft')

    const fresh = await db.product.findByPk(product.id)
    expect(fresh.stock).toBe(20)
  })

  test('completing the opname sets stock to the counted physical quantity', async () => {
    const createRes = await request(app)
      .post('/stock-opname/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        store: location.id,
        status: 'draft',
        items: [
          {
            product: product.id,
            namaBarang: product.nameProduct,
            stokAkhirJumlah: 20,
            stokFisikJumlah: 15,
            selisihJumlah: -5
          }
        ]
      })
    expect(createRes.status).toBe(201)

    const completeRes = await request(app)
      .patch(`/stock-opname/status/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' })

    expect(completeRes.status).toBe(200)

    const fresh = await db.product.findByPk(product.id)
    expect(fresh.stock).toBe(15)

    const history = await db.stock_history.findAll({
      where: { product: product.id, referenceType: 'opname' }
    })
    expect(history.length).toBe(1)
    expect(history[0].quantityChange).toBe(-5)
    expect(history[0].quantityAfter).toBe(15)

    const opname = await db.stockOpname.findByPk(createRes.body.data.id)
    expect(opname.status).toBe('completed')
  })

  test('cannot change status of an opname that is not in draft status', async () => {
    const createRes = await request(app)
      .post('/stock-opname/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        store: location.id,
        status: 'draft',
        items: [
          {
            product: product.id,
            namaBarang: product.nameProduct,
            stokAkhirJumlah: 15,
            stokFisikJumlah: 15,
            selisihJumlah: 0
          }
        ]
      })
    expect(createRes.status).toBe(201)

    const firstComplete = await request(app)
      .patch(`/stock-opname/status/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' })
    expect(firstComplete.status).toBe(200)

    const secondComplete = await request(app)
      .patch(`/stock-opname/status/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })

    expect(secondComplete.status).toBe(400)
  })
})
