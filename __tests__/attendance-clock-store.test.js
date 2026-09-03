process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let ownStore = null
let otherStore = null
let employee = null
let employeeStore1Token = null

beforeAll(async () => {
  // `store` FKs to location.id — create two real locations so the spoof
  // attempt below targets a genuinely different, valid store. attendance.userId
  // FKs to user.id, so the token subject needs a real user row too.
  ownStore = await db.location.create({ name: 'ATT_OWN_STORE', status: 'active' })
  otherStore = await db.location.create({ name: 'ATT_OTHER_STORE', status: 'active' })
  employee = await db.user.create({
    userName: 'employee_store1_att',
    email: 'employee_store1_att@test.com',
    roleType: 'user',
    userType: 'user',
    store: ownStore.id,
    status: 'active'
  })

  employeeStore1Token = jwt.sign(
    {
      id: employee.id,
      userName: employee.userName,
      roleType: 'user',
      store: ownStore.id
    },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.attendance.destroy({ where: { userId: employee?.id }, force: true })
  await db.user.destroy({ where: { id: employee?.id }, force: true })
  await db.location.destroy({
    where: { id: [ownStore?.id, otherStore?.id].filter(Boolean) },
    force: true
  })
})

// Regression test: /attendance/clock used to resolve the clock-in store from
// req.body.storeId/store (or a cookie) before falling back to the
// authenticated user's own store, so a client could clock in against a
// store they don't work at.
describe('attendance clock-in store spoofing regression', () => {
  test('clock-in store always comes from the JWT, ignoring a spoofed body.store', async () => {
    const res = await request(app)
      .post('/attendance/clock')
      .set('Authorization', `Bearer ${employeeStore1Token}`)
      .send({
        type: 'check-in',
        store: otherStore.id, // attempted spoof to a real, different store
        latitude: -6.2,
        longitude: 106.8,
        accuracy: 20
      })

    expect(res.status).toBe(201)
    expect(res.body.data.store).toBe(ownStore.id)
  })
})
