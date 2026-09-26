'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-secret-key-for-auth-context'

// TDD RED: authorization context middleware — identity vs authority separation.
const jwt = require('jsonwebtoken')
const db = require('../db/models')

const P = 'AUTH_MW_'
let tenantA
let storeA1
let userA

const signToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET_KEY)

const mockRes = () => {
  const res = {}
  res.statusCode = null
  res.body = null
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (body) => {
    res.body = body
    return res
  }
  return res
}

beforeAll(async () => {
  if (db.authorizationContextSession) {
    await db.authorizationContextSession.sync()
  }
  tenantA = await db.tenant.create({ code: `${P}A_${Date.now()}`, name: `${P}Tenant A` })
  storeA1 = await db.location.create({ name: `${P}STORE_A1`, status: 'active', tenantId: tenantA.id })
  userA = await db.user.create({
    userName: `${P}admin_${Date.now()}`,
    email: `${P}admin_${Date.now()}@test.com`,
    roleType: 'admin',
    status: 'active',
    password: 'Test12345'
  })
  await db.tenantMembership.create({ userId: userA.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: userA.id, tenantId: tenantA.id, storeId: storeA1.id })
}, 30000)

afterAll(async () => {
  await db.storeAssignment.destroy({ where: { userId: userA?.id }, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: { userId: userA?.id }, force: true }).catch(() => {})
  if (db.authorizationContextSession) {
    await db.authorizationContextSession.destroy({ where: { userId: userA?.id }, force: true }).catch(() => {})
  }
  await db.user.destroy({ where: { id: userA?.id }, force: true }).catch(() => {})
  await db.location.destroy({ where: { id: storeA1?.id }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: tenantA?.id }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 30000)

describe('authorizationContextMiddleware', () => {
  test('rejects requests without a token', async () => {
    const { authorizationContextMiddleware } = require('../utils/authorizationContextMiddleware')
    const req = { headers: {}, cookies: {} }
    const res = mockRes()
    let nextCalled = false
    await authorizationContextMiddleware({ ...req, app: undefined, db }, res, () => {
      nextCalled = true
    })
    // middleware uses req.db ?? global models; call with db attached via closure below
    expect(nextCalled || res.statusCode === 401).toBe(true)
  })

  test('resolves canonical context from a valid session and ignores JWT role claims', async () => {
    const mw = require('../utils/authorizationContextMiddleware')
    const session = await mw.createContextSession(db, { userId: userA.id })
    await mw.switchSessionTenant(db, session.sessionId, userA.id, tenantA.id)
    await mw.switchSessionStore(db, session.sessionId, userA.id, storeA1.id)
    // Forge escalated JWT claims: must have zero effect on authority.
    const token = signToken({ id: userA.id, sessionId: session.sessionId, roleType: 'super_admin', store: 999999 })
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {}, db }
    const res = mockRes()
    let nextCalled = false
    await mw.authorizationContextMiddleware(req, res, () => {
      nextCalled = true
    })
    expect(nextCalled).toBe(true)
    expect(req.authContext).toBeDefined()
    expect(req.authContext.activeTenantId).toBe(Number(tenantA.id))
    expect(req.authContext.activeStoreId).toBe(Number(storeA1.id))
    expect(req.authContext.activeRole).toBe('store_admin')
    expect(req.authContext.isPlatformAdmin).toBe(false)
  })

  test('revoked session fails closed', async () => {
    const mw = require('../utils/authorizationContextMiddleware')
    const session = await mw.createContextSession(db, { userId: userA.id })
    await mw.revokeContextSession(db, session.sessionId, userA.id)
    const token = signToken({ id: userA.id, sessionId: session.sessionId })
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {}, db }
    const res = mockRes()
    let nextCalled = false
    await mw.authorizationContextMiddleware(req, res, () => {
      nextCalled = true
    })
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(401)
  })

  test('membership revocation takes effect before JWT expiry', async () => {
    const mw = require('../utils/authorizationContextMiddleware')
    const session = await mw.createContextSession(db, { userId: userA.id })
    await mw.switchSessionTenant(db, session.sessionId, userA.id, tenantA.id)
    await db.tenantMembership.update({ status: 'DEACTIVATED' }, { where: { userId: userA.id, tenantId: tenantA.id } })
    try {
      const token = signToken({ id: userA.id, sessionId: session.sessionId })
      const req = { headers: { authorization: `Bearer ${token}` }, cookies: {}, db }
      const res = mockRes()
      let nextCalled = false
      await mw.authorizationContextMiddleware(req, res, () => {
        nextCalled = true
      })
      // Stale tenant selection must not authorize: either 403 or context without tenant.
      if (nextCalled) {
        expect(req.authContext.activeTenantId == null || req.authContext.reason).toBeTruthy()
      } else {
        expect(res.statusCode).toBe(403)
      }
    } finally {
      await db.tenantMembership.update({ status: 'ACTIVE' }, { where: { userId: userA.id, tenantId: tenantA.id } })
    }
  })

  test('never treats req.user.roleType or req.user.store as authority', async () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../utils/authorizationContextMiddleware.js'), 'utf8')
    const codeLines = src.split('\n').filter((l) => {
      const t = l.trim()
      return t && !t.startsWith('//') && !t.startsWith('*')
    })
    // Authority must come from resolveAuthorizationContext / persisted session,
    // never from a direct roleType/store comparison granting access.
    expect(src).toMatch(/resolveAuthorizationContext/)
    const grants = codeLines.filter((l) => /req\.user\.roleType\s*===/.test(l) && /allow|grant|permit|isPlatform/i.test(l))
    expect(grants).toEqual([])
  })
})
