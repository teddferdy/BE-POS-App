process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let store1 = null
let store2 = null
let adminStore1Token = null
let superAdminToken = null
let userInStore1 = null
let userInStore2 = null

beforeAll(async () => {
  // `store` columns FK to location.id, not to any business-facing number —
  // create real locations and use their ids everywhere below.
  store1 = await db.location.create({ name: 'PRIV_STORE_1', status: 'active' })
  store2 = await db.location.create({ name: 'PRIV_STORE_2', status: 'active' })

  adminStore1Token = jwt.sign(
    { id: 8001, userName: 'admin1_priv', roleType: 'admin', store: store1.id },
    JWT_SECRET
  )
  superAdminToken = jwt.sign(
    { id: 8000, userName: 'superadmin_priv', roleType: 'super_admin' },
    JWT_SECRET
  )

  userInStore1 = await db.user.create({
    userName: 'target_store1_priv',
    email: 'target1_priv@test.com',
    roleType: 'user',
    userType: 'user',
    store: store1.id,
    status: 'active'
  })
  userInStore2 = await db.user.create({
    userName: 'target_store2_priv',
    email: 'target2_priv@test.com',
    roleType: 'user',
    userType: 'user',
    store: store2.id,
    status: 'active'
  })
})

afterAll(async () => {
  await db.user.destroy({
    where: { id: [userInStore1?.id, userInStore2?.id].filter(Boolean) },
    force: true
  })
  await db.location.destroy({
    where: { id: [store1?.id, store2?.id].filter(Boolean) },
    force: true
  })
})

// Regression tests for a privilege-escalation bug: an `admin` could promote
// any `user`-role account to `super_admin`, and the store-scoping check was
// skipped whenever the target's current role was `user`.
describe('auth privilege-escalation regression (change-profile-user / change-user-status)', () => {
  test('admin cannot promote a user to super_admin', async () => {
    const res = await request(app)
      .put('/auth/change-profile-user')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({
        id: userInStore1.id,
        roleType: 'super_admin',
        userType: 'admin',
        position: 0,
        store: store1.id
      })

    expect(res.status).toBe(403)
    const fresh = await db.user.findByPk(userInStore1.id)
    expect(fresh.roleType).toBe('user')
  })

  test('admin cannot edit a user-role account belonging to a different store', async () => {
    const res = await request(app)
      .put('/auth/change-profile-user')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({
        id: userInStore2.id,
        roleType: 'user',
        userType: 'user',
        position: 0,
        store: store2.id
      })

    expect(res.status).toBe(403)
  })

  test('admin cannot move a user in their own store to a different store', async () => {
    const res = await request(app)
      .put('/auth/change-profile-user')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({
        id: userInStore1.id,
        roleType: 'user',
        userType: 'user',
        position: 0,
        store: store2.id
      })

    expect(res.status).toBe(403)
    const fresh = await db.user.findByPk(userInStore1.id)
    expect(fresh.store).toBe(store1.id)
  })

  test('admin cannot deactivate a user-role account in a different store', async () => {
    const res = await request(app)
      .put('/auth/change-user-status')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ id: userInStore2.id, status: 'inactive' })

    expect(res.status).toBe(403)
    const fresh = await db.user.findByPk(userInStore2.id)
    expect(fresh.status).toBe('active')
  })

  test('admin can still edit a user-role account in their own store', async () => {
    const res = await request(app)
      .put('/auth/change-profile-user')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({
        id: userInStore1.id,
        roleType: 'user',
        userType: 'admin',
        store: store1.id
      })

    expect(res.status).toBe(200)
  })

  test('super_admin can still promote a user to super_admin', async () => {
    const res = await request(app)
      .put('/auth/change-profile-user')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        id: userInStore2.id,
        roleType: 'super_admin',
        userType: 'admin',
        store: store2.id
      })

    expect(res.status).toBe(200)
    const fresh = await db.user.findByPk(userInStore2.id)
    expect(fresh.roleType).toBe('super_admin')
  })
})
