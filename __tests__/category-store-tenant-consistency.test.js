process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const excelJS = require('exceljs')
const { signSessionToken } = require('../test-helpers/authSession')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// GAP-3: category_store tenant consistency parity with product_store.
//
// - all-tenantless assignment sets stay writable (pre-cutover staging).
// - mixed tenantless+owned sets are rejected (TENANT_UNRESOLVED).
// - cross-tenant sets are rejected (CROSS_TENANT).
// - the model hook guards direct writes, bulk writes, import and transfer
//   receive propagation; controller pre-checks give shaped failures first.
// Category itself stays tenant-free: no category.tenantId.

describe('category-store tenant consistency', () => {
  let superAdminToken = null
  let superAdminUser = null
  let adminAToken = null
  let adminAUser = null
  let tenantX = null
  let tenantY = null
  let storeAX = null
  let storeBX = null
  let storeBY = null
  let storeN1 = null
  let storeN2 = null

  const catIds = []
  const prodIds = []
  const locIds = []
  const transferIds = []

  // Direct ORM fixtures mirror the application's max(id)+1 convention
  // (api/controller/location.js create path): the HTTP path inserts explicit
  // ids without advancing the sequence, so a bare nextval insert can collide
  // with an earlier explicit id depending on test order.
  const nextDirectLocationId = async () =>
    ((await db.location.max('id', { paranoid: false })) || 0) + 1

  const stamp = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const makeStore = async (name, tenantId) => {
    const row = await db.location.create({
      id: await nextDirectLocationId(),
      name: `${name}_${stamp()}`,
      status: 'active',
      phoneNumber: '081234567890',
      email: `${name.toLowerCase()}_${stamp()}@test.com`,
      tenantId: tenantId ?? null,
      createdBy: superAdminUser.id
    })
    locIds.push(row.id)
    return row
  }

  const makeCategory = async (name) => {
    const row = await db.category.create({
      name: `${name}_${stamp()}`,
      createdBy: superAdminUser.id
    })
    catIds.push(row.id)
    return row
  }

  beforeAll(async () => {
    tenantX = await db.tenant.create({ code: `G3CX_${Date.now()}`, name: 'G3C Tenant X' })
    tenantY = await db.tenant.create({ code: `G3CY_${Date.now()}`, name: 'G3C Tenant Y' })
    superAdminUser = await db.user.create({
      userName: `g3c_admin_${Date.now()}`,
      email: `g3c_admin_${Date.now()}@test.com`,
      roleType: 'super_admin',
      userType: 'admin',
      store: null,
      status: 'active'
    })
    storeAX = await makeStore('G3C_STORE_AX', tenantX.id)
    storeBX = await makeStore('G3C_STORE_BX', tenantX.id)
    storeBY = await makeStore('G3C_STORE_BY', tenantY.id)
    storeN1 = await makeStore('G3C_STORE_N1', null)
    storeN2 = await makeStore('G3C_STORE_N2', null)
    adminAUser = await db.user.create({
      userName: `g3c_store_admin_${Date.now()}`,
      email: `g3c_store_admin_${Date.now()}@test.com`,
      roleType: 'admin',
      userType: 'admin',
      store: storeAX.id,
      status: 'active'
    })
    superAdminToken = await signSessionToken(
      { id: superAdminUser.id, userName: superAdminUser.userName, roleType: 'super_admin', store: null },
      JWT_SECRET
    )
    adminAToken = await signSessionToken(
      { id: adminAUser.id, userName: adminAUser.userName, roleType: 'admin', store: storeAX.id },
      JWT_SECRET
    )
  })

  afterAll(async () => {
    await db.stock_transfer_item.destroy({ where: {}, force: true }).catch(() => {})
    await db.stock_transfer.destroy({ where: { id: transferIds }, force: true }).catch(() => {})
    await db.stock_history.destroy({ where: { product: prodIds }, force: true }).catch(() => {})
    await db.product_store_stock.destroy({ where: { product: prodIds }, force: true }).catch(() => {})
    await db.product_store.destroy({ where: { product: prodIds }, force: true }).catch(() => {})
    await db.category_store.destroy({ where: { category: catIds }, force: true }).catch(() => {})
    await db.product.destroy({ where: { id: prodIds }, force: true }).catch(() => {})
    await db.category.destroy({ where: { id: catIds }, force: true }).catch(() => {})
  // Users before locations: user.store is a real FK to location
  // (user_store_fkey); deleting bound stores first violates it.
  await db.user.destroy({ where: { id: [superAdminUser?.id, adminAUser?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.location.destroy({ where: { id: locIds }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: [tenantX?.id, tenantY?.id].filter(Boolean) }, force: true }).catch(() => {})
  })

  const junctionStores = async (categoryId) =>
    (
      await db.category_store.findAll({ where: { category: categoryId }, attributes: ['store'] })
    ).map((r) => r.store)

  test('C1 all-tenantless assignment is allowed', async () => {
    const cat = await makeCategory('G3C_C1')
    await db.category_store.create({ category: cat.id, store: storeN1.id })
    await db.category_store.create({ category: cat.id, store: storeN2.id })
    expect((await junctionStores(cat.id)).sort()).toEqual([storeN1.id, storeN2.id].sort())
  })

  test('C2 same-tenant assignment is allowed', async () => {
    const cat = await makeCategory('G3C_C2')
    await db.category_store.create({ category: cat.id, store: storeAX.id })
    await db.category_store.create({ category: cat.id, store: storeBX.id })
    expect((await junctionStores(cat.id)).sort()).toEqual([storeAX.id, storeBX.id].sort())
  })

  test('C3 mixed tenantless+owned assignment is rejected', async () => {
    const cat = await makeCategory('G3C_C3')
    await db.category_store.create({ category: cat.id, store: storeN1.id })
    await expect(
      db.category_store.create({ category: cat.id, store: storeAX.id })
    ).rejects.toThrow('a store without a tenant cannot be assigned alongside a tenant-owned store')
    expect(await junctionStores(cat.id)).toEqual([storeN1.id])
  })

  test('C4 cross-tenant assignment is rejected', async () => {
    const cat = await makeCategory('G3C_C4')
    await db.category_store.create({ category: cat.id, store: storeAX.id })
    await expect(
      db.category_store.create({ category: cat.id, store: storeBY.id })
    ).rejects.toThrow('cross-tenant assignment')
    expect(await junctionStores(cat.id)).toEqual([storeAX.id])
  })

  test('C5 direct write referencing an unknown store is rejected', async () => {
    const cat = await makeCategory('G3C_C5')
    await expect(
      db.category_store.create({ category: cat.id, store: 999999 })
    ).rejects.toThrow('store does not exist')
    expect(await junctionStores(cat.id)).toEqual([])
  })

  test('C6 direct bulk write of mixed and cross-tenant sets is rejected', async () => {
    const mixed = await makeCategory('G3C_C6M')
    await expect(
      db.category_store.bulkCreate([
        { category: mixed.id, store: storeN1.id },
        { category: mixed.id, store: storeAX.id }
      ])
    ).rejects.toThrow('a store without a tenant cannot be assigned alongside a tenant-owned store')
    expect(await junctionStores(mixed.id)).toEqual([])

    const cross = await makeCategory('G3C_C6X')
    await expect(
      db.category_store.bulkCreate([
        { category: cross.id, store: storeAX.id },
        { category: cross.id, store: storeBY.id }
      ])
    ).rejects.toThrow('cross-tenant assignment')
    expect(await junctionStores(cross.id)).toEqual([])
  })

  test('C7 normal controller write assigns own store', async () => {
    const name = `G3C_C7_${stamp()}`
    const res = await request(app)
      .post('/category/add-new-category')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name })
    expect(res.status).toBe(200)
    const cat = await db.category.findOne({ where: { name } })
    expect(cat).not.toBeNull()
    catIds.push(cat.id)
    expect(await junctionStores(cat.id)).toEqual([storeAX.id])
  })

  test('C8 controller foreign-store attempt is rejected', async () => {
    const name = `G3C_C8_${stamp()}`
    const res = await request(app)
      .post('/category/add-new-category')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name, store: [storeBY.id] })
    expect(res.status).toBe(403)
    expect(await db.category.findOne({ where: { name } })).toBeNull()
  })

  const buildCategoryImport = (storeName) => {
    const name = `G3C_IMP_${stamp()}`
    const workbook = new excelJS.Workbook()
    const worksheet = workbook.addWorksheet('Category')
    worksheet.addRow(['No', 'Name', 'Description', 'Store', 'isActive'])
    worksheet.addRow([1, name, 'imported', storeName, 'active'])
    return workbook.xlsx.writeBuffer().then((buffer) => ({ buffer, name }))
  }

  test('C9 import into authorized same-tenant store succeeds', async () => {
    const { buffer, name } = await buildCategoryImport(storeAX.name)
    const res = await request(app)
      .post('/category/upload-excel')
      .set('Authorization', `Bearer ${adminAToken}`)
      .attach('file', buffer, 'categories.xlsx')
    expect(res.status).toBe(201)
    const created = await db.category.findOne({ where: { name } })
    expect(created).not.toBeNull()
    catIds.push(created.id)
    expect(await junctionStores(created.id)).toEqual([storeAX.id])
  })

  test('C10 import naming a foreign store creates no foreign mapping', async () => {
    const before = await db.category_store.count({ where: { store: storeBY.id } })
    const { buffer, name } = await buildCategoryImport(storeBY.name)
    const res = await request(app)
      .post('/category/upload-excel')
      .set('Authorization', `Bearer ${adminAToken}`)
      .attach('file', buffer, 'categories.xlsx')
    // Mirrors the product import HIGH-7 boundary: the foreign-store row is
    // rejected instead of resolving tenant-blind, before any row is written.
    expect(res.status).toBe(500)
    expect(await db.category.findOne({ where: { name } })).toBeNull()
    expect(await db.category_store.count({ where: { store: storeBY.id } })).toBe(before)
  })

  const makeTransferProduct = async (tag, categoryId, storeId, stock) => {
    const product = await db.product.create({
      nameProduct: `G3C_PROD_${tag}_${stamp()}`,
      category: categoryId,
      price: 5000,
      stock
    })
    prodIds.push(product.id)
    await db.product_store_stock.create({ product: product.id, store: storeId, stock })
    return product
  }

  test('C11 receive propagation succeeds within one tenant', async () => {
    const cat = await makeCategory('G3C_C11')
    await db.category_store.create({ category: cat.id, store: storeAX.id })
    const product = await makeTransferProduct('C11', cat.id, storeAX.id, 10)
    const sent = await request(app)
      .post('/pos/transfer')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ fromStore: storeAX.id, toStore: storeBX.id, items: [{ productId: product.id, qty: 2 }] })
    expect(sent.status).toBe(201)
    transferIds.push(sent.body.data.id)
    const received = await request(app)
      .put(`/pos/transfer/${sent.body.data.id}/receive`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({})
    expect(received.status).toBe(200)
    expect((await junctionStores(cat.id)).sort()).toEqual([storeAX.id, storeBX.id].sort())
  })

  test('C12 receive propagation violating the invariant is rejected', async () => {
    const cat = await makeCategory('G3C_C12')
    await db.category_store.create({ category: cat.id, store: storeBY.id })
    const product = await makeTransferProduct('C12', cat.id, storeAX.id, 10)
    await db.product_store.create({ product: product.id, store: storeAX.id })
    const sent = await request(app)
      .post('/pos/transfer')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ fromStore: storeAX.id, toStore: storeBX.id, items: [{ productId: product.id, qty: 2 }] })
    expect(sent.status).toBe(201)
    transferIds.push(sent.body.data.id)
    const received = await request(app)
      .put(`/pos/transfer/${sent.body.data.id}/receive`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({})
    expect(received.status).toBe(400)
    expect(received.body.message).toMatch('category_store rejected: cross-tenant assignment')
    expect((await db.stock_transfer.findByPk(sent.body.data.id)).status).toBe('sent')
    expect(await junctionStores(cat.id)).toEqual([storeBY.id])
  })
})
