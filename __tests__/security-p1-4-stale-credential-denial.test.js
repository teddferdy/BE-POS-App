process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'
const DENIED = 'Akses Ditolak - Anda tidak memiliki izin'
const PREFIX = `p14_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
let seq = 0
const unique = (key) => `${PREFIX}_${key}_${++seq}`.toLowerCase()
const sign = (claims) => jwt.sign(claims, JWT_SECRET)
const bearer = (token) => ({ Authorization: `Bearer ${token}` })
const PASSWORD = 'Rahasia123!'

let storeA = null
const createdUserIds = []
let caller = null
let empA = null

const snapshotAuth = async (id) => {
  const row = await db.user.findByPk(id, { paranoid: false })
  const plain = row.get({ plain: true })
  return { status: plain.status, disabledAt: plain.disabledAt || null, updatedAt: plain.updatedAt }
}

beforeAll(async () => {
  storeA = await db.location.create({ name: unique('STORE_A'), status: 'active' })
  const mk = async (key, attrs) => {
    const name = unique(key)
    const row = await db.user.create({
      userName: name,
      email: `${name}@test.com`,
      password: PASSWORD,
      fullName: name,
      userType: 'user',
      roleType: 'user',
      status: 'active',
      store: storeA.id,
      ...attrs
    })
    createdUserIds.push(row.id)
    return row
  }
  caller = await mk('caller', { roleType: 'admin', userType: 'admin' })
  empA = await mk('empA', { employeeID: `E${Date.now()}${++seq}` })
})

afterAll(async () => {
  const rows = await db.user.findAll({ where: { id: createdUserIds }, attributes: ['id'], paranoid: false })
  const ids = rows.map((r) => r.id)
  if (ids.length) {
    await db.authorizationContextSession.destroy({ where: { userId: ids }, force: true }).catch(() => {})
    await db.user.destroy({ where: { id: ids }, force: true }).catch(() => {})
  }
  await db.location.destroy({ where: { id: [storeA?.id].filter(Boolean) }, force: true }).catch(() => {})
})

const callerToken = () => sign({ id: caller.id, roleType: 'admin', store: storeA.id })
const empPath = () => `/employee/get-employee/${empA.id}`

describe('P1-4 legacy stale credential denial', () => {
  test('enabled JWT control → 200', async () => {
    const res = await request(app).get(empPath()).set(bearer(callerToken()))
    expect(res.status).toBe(200)
  })

  test('disable → same JWT 403 exact shape, no mutation', async () => {
    await db.user.update({ disabledAt: new Date() }, { where: { id: caller.id } })
    const before = await snapshotAuth(caller.id)
    const res = await request(app).get(empPath()).set(bearer(callerToken()))
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(DENIED)
    const after = await snapshotAuth(caller.id)
    expect(after.status).toBe(before.status)
    expect(new Date(after.disabledAt).getTime()).toBe(new Date(before.disabledAt).getTime())
    expect(after.updatedAt).toEqual(before.updatedAt)
    await db.user.update({ disabledAt: null }, { where: { id: caller.id } })
  })
})

describe('P1-4 session-backed stale credential denial', () => {
  test('login session works; disable → same token 403; session row untouched', async () => {
    const login = await request(app).post('/auth/login').send({ userName: caller.userName, password: PASSWORD })
    expect(login.status).toBe(200)
    const token = login.body.token
    expect(token).toBeDefined()
    let res = await request(app).get(empPath()).set(bearer(token))
    expect(res.status).toBe(200)

    await db.user.update({ disabledAt: new Date() }, { where: { id: caller.id } })
    const sessBefore = await db.authorizationContextSession.findAll({ where: { userId: caller.id } })
    res = await request(app).get(empPath()).set(bearer(token))
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(DENIED)
    const sessAfter = await db.authorizationContextSession.findAll({ where: { userId: caller.id } })
    expect(sessAfter.length).toBe(sessBefore.length)
    for (const s of sessAfter) expect(s.revokedAt).toBeNull()
    await db.user.update({ disabledAt: null }, { where: { id: caller.id } })
  })
})

describe('P1-4 canonical route denial', () => {
  test('enabled /auth/context succeeds; disable → same credential 403, handler skipped', async () => {
    const login = await request(app).post('/auth/login').send({ userName: caller.userName, password: PASSWORD })
    const token = login.body.token
    let res = await request(app).get('/auth/context').set(bearer(token))
    expect(res.status).toBe(200)

    await db.user.update({ disabledAt: new Date() }, { where: { id: caller.id } })
    res = await request(app).get('/auth/context').set(bearer(token))
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(DENIED)
    await db.user.update({ disabledAt: null }, { where: { id: caller.id } })
  })
})

describe('P1-4 re-enable limitation (documented)', () => {
  test('old JWT denied while disabled; re-enable restores fresh login; old JWT shape follows current-state check', async () => {
    const tok = callerToken()
    await db.user.update({ disabledAt: new Date() }, { where: { id: caller.id } })
    expect((await request(app).get(empPath()).set(bearer(tok))).status).toBe(403)

    await db.user.update({ disabledAt: null }, { where: { id: caller.id } })
    const login = await request(app).post('/auth/login').send({ userName: caller.userName, password: PASSWORD })
    expect(login.status).toBe(200)
    expect(login.body.token).toBeDefined()
    // No versioning/blacklist in scope: the same pre-disable JWT validates
    // again once current state is enabled. Locked architectural limitation.
    expect((await request(app).get(empPath()).set(bearer(tok))).status).toBe(200)
  })
})

describe('P1-4 unknown/soft-deleted caller denial', () => {
  test('signed JWT for nonexistent user → 403 same shape', async () => {
    const tok = sign({ id: 2147480000, roleType: 'admin', store: storeA.id })
    const res = await request(app).get(empPath()).set(bearer(tok))
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(DENIED)
  })

  test('signed JWT for soft-deleted user → 403 same shape', async () => {
    const name = unique('gone')
    const row = await db.user.create({
      userName: name,
      email: `${name}@test.com`,
      password: PASSWORD,
      fullName: name,
      userType: 'user',
      roleType: 'user',
      status: 'active',
      store: storeA.id
    })
    createdUserIds.push(row.id)
    const tok = sign({ id: row.id, roleType: 'user', store: storeA.id })
    await db.user.destroy({ where: { id: row.id } })
    const res = await request(app).get(empPath()).set(bearer(tok))
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(DENIED)
  })
})
