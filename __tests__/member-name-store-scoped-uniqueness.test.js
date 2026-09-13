process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// C13: the DB-level uq_member_name constraint was a GLOBAL unique constraint
// on member.name, stricter than the application's own store-scoped
// duplicate-name check (api/controller/member.js addNewMember/editMember).
// This meant two different stores could never register a member with the
// same name, even though the app already intended to allow it.
//
// This suite verifies the app-facing contract (via POST /member/add-new-member)
// AND the raw DB constraint directly (bypassing the controller), since the
// requirement is specifically that DB enforcement matches app semantics, not
// just that the controller happens to reject duplicates.

let storeA = null
let storeB = null
let adminAToken = null
let adminBToken = null
let superAdminToken = null

beforeAll(async () => {
  storeA = await db.location.create({ name: 'C13_STORE_A', status: 'active' })
  storeB = await db.location.create({ name: 'C13_STORE_B', status: 'active' })

  adminAToken = jwt.sign(
    { id: 9101, userName: 'c13_admin_a', roleType: 'admin', store: storeA.id },
    JWT_SECRET
  )
  adminBToken = jwt.sign(
    { id: 9102, userName: 'c13_admin_b', roleType: 'admin', store: storeB.id },
    JWT_SECRET
  )
  superAdminToken = jwt.sign(
    { id: 9103, userName: 'c13_super_admin', roleType: 'super_admin', store: null },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.member.destroy({
    where: { store: [storeA?.id, storeB?.id].filter(Boolean) },
    force: true
  })
  await db.member.destroy({ where: { name: { [db.Sequelize.Op.iLike]: 'C13_GLOBAL_%' } }, force: true })
  await db.location.destroy({ where: { id: [storeA?.id, storeB?.id].filter(Boolean) }, force: true })
})

const addMember = (token, body) =>
  request(app)
    .post('/member/add-new-member')
    .set('Authorization', `Bearer ${token}`)
    .send(body)

describe('C13 — member name uniqueness is store-scoped (HTTP contract)', () => {
  test('same store + same name -> second registration is rejected (409)', async () => {
    const first = await addMember(adminAToken, {
      nameMember: 'C13 Duplicate Name',
      phoneNumber: '081300000001'
    })
    expect(first.status).toBe(201)

    const second = await addMember(adminAToken, {
      nameMember: 'C13 Duplicate Name',
      phoneNumber: '081300000002'
    })
    expect(second.status).toBe(409)
  })

  test('different stores + same name -> both registrations succeed', async () => {
    const inStoreA = await addMember(adminAToken, {
      nameMember: 'C13 Shared Name',
      phoneNumber: '081300000003'
    })
    expect(inStoreA.status).toBe(201)

    const inStoreB = await addMember(adminBToken, {
      nameMember: 'C13 Shared Name',
      phoneNumber: '081300000004'
    })
    expect(inStoreB.status).toBe(201)
    expect(inStoreB.body.data.store).toBe(storeB.id)
  })

  test('a normal, non-duplicate member registration still works', async () => {
    const res = await addMember(adminAToken, {
      nameMember: 'C13 Unique Member',
      phoneNumber: '081300000005'
    })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('C13 Unique Member')
  })

  test('two global (store-null) members with the same name -> second is rejected (409)', async () => {
    const first = await addMember(superAdminToken, {
      nameMember: 'C13_GLOBAL_Shared',
      phoneNumber: '081300000006'
    })
    expect(first.status).toBe(201)
    expect(first.body.data.store).toBeFalsy()

    const second = await addMember(superAdminToken, {
      nameMember: 'C13_GLOBAL_Shared',
      phoneNumber: '081300000007'
    })
    expect(second.status).toBe(409)
  })
})

describe('C13 — DB constraint enforces store-scoped uniqueness directly (bypassing the controller)', () => {
  test('the DB rejects a second (store, name) duplicate even via a direct model create', async () => {
    await db.member.create({
      name: 'C13 Direct DB Dup',
      phoneNumber: '081300000008',
      store: storeA.id
    })

    await expect(
      db.member.create({
        name: 'C13 Direct DB Dup',
        phoneNumber: '081300000009',
        store: storeA.id
      })
    ).rejects.toThrow()
  })

  test('the DB allows the same name across two different stores via a direct model create', async () => {
    await db.member.create({
      name: 'C13 Direct DB Cross Store',
      phoneNumber: '081300000010',
      store: storeA.id
    })

    await expect(
      db.member.create({
        name: 'C13 Direct DB Cross Store',
        phoneNumber: '081300000011',
        store: storeB.id
      })
    ).resolves.toBeTruthy()
  })
})
