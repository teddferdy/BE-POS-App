'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-secret-key-for-auth-context'

// TDD RED: server-side authorization context session persistence + lifecycle.
// Uses isolated cashier_app_test DB only.
const db = require('../db/models')

const P = 'AUTH_SESS_'
let tenantA
let tenantB
let storeA1
let storeA2
let storeB1
let userA

const mkUser = async (key, roleType, extra = {}) =>
  db.user.create({
    userName: `${P}${key}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    email: `${P}${key}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@test.com`,
    roleType,
    status: 'active',
    password: 'Test12345',
    ...extra
  })

beforeAll(async () => {
  // Ensure the session table exists on test DBs cloned before the migration.
  if (db.authorizationContextSession) {
    await db.authorizationContextSession.sync()
  }
  tenantA = await db.tenant.create({ code: `${P}A_${Date.now()}`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${P}B_${Date.now()}`, name: `${P}Tenant B` })
  storeA1 = await db.location.create({ name: `${P}STORE_A1`, status: 'active', tenantId: tenantA.id })
  storeA2 = await db.location.create({ name: `${P}STORE_A2`, status: 'active', tenantId: tenantA.id })
  storeB1 = await db.location.create({ name: `${P}STORE_B1`, status: 'active', tenantId: tenantB.id })
  userA = await mkUser('admin', 'admin')
  await db.tenantMembership.create({ userId: userA.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: userA.id, tenantId: tenantB.id, role: 'store_admin', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: userA.id, tenantId: tenantA.id, storeId: storeA1.id })
  await db.storeAssignment.create({ userId: userA.id, tenantId: tenantB.id, storeId: storeB1.id })
}, 30000)

afterAll(async () => {
  await db.storeAssignment.destroy({ where: { userId: userA?.id }, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: { userId: userA?.id }, force: true }).catch(() => {})
  if (db.authorizationContextSession) {
    await db.authorizationContextSession.destroy({ where: { userId: userA?.id }, force: true }).catch(() => {})
  }
  await db.user.destroy({ where: { id: userA?.id }, force: true }).catch(() => {})
  await db.location.destroy({ where: { id: [storeA1?.id, storeA2?.id, storeB1?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 30000)

describe('authorization context session model', () => {
  test('creates isolated sessions with opaque ids', async () => {
    const { createContextSession } = require('../utils/authorizationContextMiddleware')
    const s1 = await createContextSession(db, { userId: userA.id })
    const s2 = await createContextSession(db, { userId: userA.id })
    expect(s1.sessionId).toBeDefined()
    expect(s2.sessionId).toBeDefined()
    expect(s1.sessionId).not.toBe(s2.sessionId)
    expect(s1.sessionId.length).toBeGreaterThanOrEqual(32)
  })

  test('multiple sessions can hold different tenants', async () => {
    const { createContextSession, switchSessionTenant } = require('../utils/authorizationContextMiddleware')
    const s1 = await createContextSession(db, { userId: userA.id })
    const s2 = await createContextSession(db, { userId: userA.id })
    await switchSessionTenant(db, s1.sessionId, userA.id, tenantA.id)
    await switchSessionTenant(db, s2.sessionId, userA.id, tenantB.id)
    const r1 = await db.authorizationContextSession.findOne({ where: { sessionId: s1.sessionId } })
    const r2 = await db.authorizationContextSession.findOne({ where: { sessionId: s2.sessionId } })
    expect(Number(r1.activeTenantId)).toBe(Number(tenantA.id))
    expect(Number(r2.activeTenantId)).toBe(Number(tenantB.id))
  })

  test('session-specific store context is isolated', async () => {
    const { createContextSession, switchSessionTenant, switchSessionStore } = require('../utils/authorizationContextMiddleware')
    const s1 = await createContextSession(db, { userId: userA.id })
    const s2 = await createContextSession(db, { userId: userA.id })
    await switchSessionTenant(db, s1.sessionId, userA.id, tenantA.id)
    await switchSessionTenant(db, s2.sessionId, userA.id, tenantB.id)
    await switchSessionStore(db, s1.sessionId, userA.id, storeA1.id)
    const r1 = await db.authorizationContextSession.findOne({ where: { sessionId: s1.sessionId } })
    const r2 = await db.authorizationContextSession.findOne({ where: { sessionId: s2.sessionId } })
    expect(Number(r1.activeStoreId)).toBe(Number(storeA1.id))
    expect(r2.activeStoreId).toBeNull()
  })

  test('revoking one session leaves others usable', async () => {
    const { createContextSession, revokeContextSession, loadContextSession } = require('../utils/authorizationContextMiddleware')
    const s1 = await createContextSession(db, { userId: userA.id })
    const s2 = await createContextSession(db, { userId: userA.id })
    await revokeContextSession(db, s1.sessionId, userA.id)
    expect(await loadContextSession(db, s1.sessionId)).toBeNull()
    expect(await loadContextSession(db, s2.sessionId)).not.toBeNull()
  })

  test('expired session cannot authorize', async () => {
    const { createContextSession, loadContextSession } = require('../utils/authorizationContextMiddleware')
    const s = await createContextSession(db, { userId: userA.id, ttlMs: -1000 })
    expect(await loadContextSession(db, s.sessionId)).toBeNull()
  })

  test('tenant switch is atomic: failure leaves prior context intact', async () => {
    const { createContextSession, switchSessionTenant } = require('../utils/authorizationContextMiddleware')
    const s = await createContextSession(db, { userId: userA.id })
    await switchSessionTenant(db, s.sessionId, userA.id, tenantA.id)
    await expect(switchSessionTenant(db, s.sessionId, userA.id, 99999999)).rejects.toThrow()
    const row = await db.authorizationContextSession.findOne({ where: { sessionId: s.sessionId } })
    expect(Number(row.activeTenantId)).toBe(Number(tenantA.id))
  })
})

describe('authorization context HTTP contracts', () => {
  const express = require('express')
  const request = require('supertest')

  test('tenant switch clears stale store selection', async () => {
    const { createContextSession, switchSessionTenant, switchSessionStore } = require('../utils/authorizationContextMiddleware')
    const s = await createContextSession(db, { userId: userA.id })
    await switchSessionTenant(db, s.sessionId, userA.id, tenantA.id)
    await switchSessionStore(db, s.sessionId, userA.id, storeA1.id)
    await switchSessionTenant(db, s.sessionId, userA.id, tenantB.id)
    const row = await db.authorizationContextSession.findOne({ where: { sessionId: s.sessionId } })
    expect(Number(row.activeTenantId)).toBe(Number(tenantB.id))
    expect(row.activeStoreId).toBeNull()
  })

  const buildApp = () => {
    const app = express()
    app.use(express.json())
    // Attach db for middleware resolution.
    app.use((req, _res, next) => {
      req.db = db
      next()
    })
    app.use(
      '/auth',
      require('../api/routes/authorizationContext')
    )
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }))
    return app
  }

  test('GET /auth/context returns the resolved context', async () => {
    const mw = require('../utils/authorizationContextMiddleware')
    const session = await mw.createContextSession(db, { userId: userA.id })
    await mw.switchSessionTenant(db, session.sessionId, userA.id, tenantA.id)
    const token = require('jsonwebtoken').sign(
      { id: userA.id, sessionId: session.sessionId },
      process.env.JWT_SECRET_KEY
    )
    const res = await request(buildApp())
      .get('/auth/context')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.context.activeTenantId).toBe(Number(tenantA.id))
  })

  test('POST /auth/context/tenant + /store switch atomically, DELETE clears', async () => {
    const mw = require('../utils/authorizationContextMiddleware')
    const session = await mw.createContextSession(db, { userId: userA.id })
    const token = require('jsonwebtoken').sign(
      { id: userA.id, sessionId: session.sessionId },
      process.env.JWT_SECRET_KEY
    )
    const app = buildApp()
    const tRes = await request(app)
      .post('/auth/context/tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: tenantB.id })
    expect(tRes.status).toBe(200)
    expect(Number(tRes.body.data.activeTenantId)).toBe(Number(tenantB.id))
    const sRes = await request(app)
      .post('/auth/context/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ storeId: storeB1.id })
    expect(sRes.status).toBe(200)
    expect(Number(sRes.body.data.activeStoreId)).toBe(Number(storeB1.id))
    // Foreign store is rejected deterministically.
    const bad = await request(app)
      .post('/auth/context/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ storeId: storeA1.id })
    expect(bad.status).toBe(403)
    const del = await request(app).delete('/auth/context').set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)
    const after = await request(app).get('/auth/context').set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(401)
  })
})
