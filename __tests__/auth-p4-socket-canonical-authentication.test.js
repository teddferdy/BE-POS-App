process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// AUTH-1 P4 — Socket.IO canonical authentication and live revocation. The
// handshake enforces the same credential as HTTP (P2): JWT signature/expiry,
// a required sessionId, a live session owned by the JWT's id and an eligible
// account; socket identity is hydrated from the DB and JWT role/store claims
// are never authority. Every join re-checks the session, and a committed P3
// revocation disconnects the affected live sockets.

const http = require('http')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { io: socketClient } = require('socket.io-client')
const { initSocket, getIO, emitNewOrder, disconnectSession } = require('../api/service/socket')
const app = require('../api/index')
const db = require('../db/models')
const mw = require('../utils/authorizationContextMiddleware')
const { hashResetToken } = require('../utils/resetToken')
const { signSessionToken } = require('../test-helpers/authSession')

const SECRET = process.env.JWT_SECRET_KEY
const PASSWORD = 'Rahasia123!'
const PREFIX = `p4sk_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
let seq = 0
const unique = (key) => `${PREFIX}_${key}_${++seq}`.toLowerCase()
const bearer = (token) => ({ Authorization: `Bearer ${token}` })
const sockOpts = { transports: ['websocket'], reconnection: false, timeout: 3000 }

let server = null
let port = null
let tenant = null
let storeA = null
let storeB = null
let admin = null
let adminHttpToken = null
let storeAdmin = null
const createdUserIds = []

const baseUrl = () => `http://127.0.0.1:${port}`

const connect = (token) =>
  new Promise((resolve, reject) => {
    const sock = socketClient(baseUrl(), { ...sockOpts, auth: token ? { token } : {} })
    const timer = setTimeout(() => {
      sock.disconnect()
      reject(new Error('socket connect timeout'))
    }, 3000)
    sock.on('connect', () => {
      clearTimeout(timer)
      resolve(sock)
    })
    sock.on('connect_error', (err) => {
      clearTimeout(timer)
      sock.disconnect()
      reject(err)
    })
  })

const joinAck = (sock, event, storeId) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 1500)
    sock.emit(event, storeId, (res) => {
      clearTimeout(timer)
      resolve(res)
    })
  })

const awaitEvent = (sock, event, ms = 600) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    sock.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })

// Resolves with the disconnect reason, or null if the socket stays up.
const disconnection = (sock, ms = 1500) =>
  new Promise((resolve) => {
    if (!sock.connected) return resolve('already-disconnected')
    const timer = setTimeout(() => resolve(null), ms)
    sock.once('disconnect', (reason) => {
      clearTimeout(timer)
      resolve(reason)
    })
  })

const makeUser = async (key, attrs = {}) => {
  const name = unique(key)
  const row = await db.user.create({
    userName: name,
    email: `${name}@test.com`,
    password: PASSWORD,
    fullName: name,
    userType: 'user',
    roleType: 'kasir',
    status: 'active',
    store: storeA.id,
    ...attrs
  })
  createdUserIds.push(row.id)
  return row
}

// A canonical store-scoped actor (DR-12): tenant membership + assignment.
const makeMember = async (key, role, storeId, attrs = {}) => {
  const u = await makeUser(key, attrs)
  await db.tenantMembership.create({ userId: u.id, tenantId: tenant.id, role, status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: u.id, tenantId: tenant.id, storeId })
  return u
}

const tokenFor = (user, claims = {}) => signSessionToken({ id: user.id, ...claims }, SECRET)
const sessionIdOf = (token) => jwt.decode(token).sessionId
const serverSocketOf = (sock) => getIO().of('/').sockets.get(sock.id)

beforeAll(async () => {
  tenant = await db.tenant.create({ code: unique('tn'), name: unique('Tenant') })
  storeA = await db.location.create({ name: unique('STORE_A'), status: 'active', tenantId: tenant.id })
  storeB = await db.location.create({ name: unique('STORE_B'), status: 'active', tenantId: tenant.id })
  admin = await makeUser('admin', { roleType: 'admin', userType: 'admin' })
  adminHttpToken = await tokenFor(admin)
  storeAdmin = await makeMember('storeAdmin', 'store_admin', storeA.id, { roleType: 'admin', userType: 'admin' })

  server = http.createServer()
  initSocket(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = server.address().port
})

afterEach(() => {
  jest.restoreAllMocks()
})

afterAll(async () => {
  const sio = getIO()
  if (sio) {
    await new Promise((resolve) => {
      sio.close(() => resolve())
      setTimeout(resolve, 1500)
    })
  }
  if (server && server.listening) await new Promise((resolve) => server.close(resolve))
  const rows = await db.user.findAll({ where: { id: createdUserIds }, attributes: ['id'], paranoid: false })
  const ids = rows.map((r) => r.id)
  if (ids.length) {
    await db.storeAssignment.destroy({ where: { userId: ids }, force: true }).catch(() => {})
    await db.tenantMembership.destroy({ where: { userId: ids }, force: true }).catch(() => {})
    await db.authorizationContextSession.destroy({ where: { userId: ids }, force: true }).catch(() => {})
    await db.user.destroy({ where: { id: ids }, force: true }).catch(() => {})
  }
  await db.location.destroy({ where: { id: [storeA?.id, storeB?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: tenant?.id }, force: true }).catch(() => {})
})

describe('P4 handshake uses the canonical credential', () => {
  test('1: a live session connects', async () => {
    const sock = await connect(await tokenFor(await makeUser('ok')))
    expect(sock.connected).toBe(true)
    sock.disconnect()
  })

  test('2: missing token is rejected', async () => {
    await expect(connect(null)).rejects.toThrow('Authentication required')
  })

  test('3: invalid JWT is rejected', async () => {
    await expect(connect('not-a-jwt')).rejects.toThrow('Unauthorized')
  })

  test('4: expired JWT is rejected even with a live session', async () => {
    const u = await makeUser('jwtExpired')
    const sid = sessionIdOf(await tokenFor(u))
    const expired = jwt.sign({ id: u.id, sessionId: sid, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET)
    await expect(connect(expired)).rejects.toThrow('Unauthorized')
  })

  test('5: a sessionless JWT is rejected', async () => {
    const u = await makeUser('sessionless')
    await expect(connect(jwt.sign({ id: u.id, roleType: 'kasir', store: storeA.id }, SECRET))).rejects.toThrow(
      'Unauthorized'
    )
  })

  test('6: an unknown session is rejected', async () => {
    const u = await makeUser('unknownSid')
    await expect(connect(jwt.sign({ id: u.id, sessionId: 'e'.repeat(64) }, SECRET))).rejects.toThrow('Unauthorized')
  })

  test('7: a revoked session is rejected', async () => {
    const u = await makeUser('revoked')
    const token = await tokenFor(u)
    await mw.revokeContextSession(db, sessionIdOf(token), u.id)
    await expect(connect(token)).rejects.toThrow('Unauthorized')
  })

  test('8: an expired session is rejected', async () => {
    const u = await makeUser('sessExpired')
    const s = await mw.createContextSession(db, { userId: u.id, ttlMs: -1000 })
    await expect(connect(jwt.sign({ id: u.id, sessionId: s.sessionId }, SECRET))).rejects.toThrow('Unauthorized')
  })

  test("9: another user's session is rejected", async () => {
    const owner = await makeUser('owner')
    const intruder = await makeUser('intruder')
    const sid = sessionIdOf(await tokenFor(owner))
    await expect(connect(jwt.sign({ id: intruder.id, sessionId: sid }, SECRET))).rejects.toThrow('Unauthorized')
  })

  test('10: a disabled account is rejected', async () => {
    const u = await makeUser('disabled')
    const token = await tokenFor(u)
    await db.user.update({ disabledAt: new Date() }, { where: { id: u.id } })
    await expect(connect(token)).rejects.toThrow('Unauthorized')
  })

  test('11: a soft-deleted account is rejected', async () => {
    const u = await makeUser('deleted')
    const token = await tokenFor(u)
    await db.user.destroy({ where: { id: u.id } })
    await expect(connect(token)).rejects.toThrow('Unauthorized')
  })

  test('12: a session lookup failure fails closed without exposing the error', async () => {
    const token = await tokenFor(await makeUser('dbFail'))
    jest.spyOn(db.authorizationContextSession, 'findOne').mockRejectedValueOnce(new Error('db down secret'))
    const err = await connect(token).catch((e) => e)
    expect(err.message).toBe('Unauthorized')
  })
})

describe('P4 socket authority comes from the DB, never JWT claims', () => {
  test('13: a forged admin role claim cannot reach a store outside DB scope', async () => {
    const cashier = await makeMember('cashierForged', 'cashier', storeA.id)
    const sock = await connect(await tokenFor(cashier, { roleType: 'admin', store: storeB.id }))
    try {
      expect((await joinAck(sock, 'join-store', storeB.id)).ok).toBe(false)
      expect((await joinAck(sock, 'join-store', storeA.id)).ok).toBe(true)
    } finally {
      sock.disconnect()
    }
  })

  test('14: a forged super_admin claim grants no global access', async () => {
    const u = await makeUser('forgedSuper')
    const sock = await connect(await tokenFor(u, { roleType: 'super_admin', store: null }))
    try {
      expect((await joinAck(sock, 'join-store', storeA.id)).ok).toBe(false)
      expect((await joinAck(sock, 'join-kitchen', storeB.id)).ok).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('15: a forged store claim cannot cross stores', async () => {
    const sock = await connect(await tokenFor(storeAdmin, { store: storeB.id }))
    try {
      expect((await joinAck(sock, 'join-kitchen', storeB.id)).ok).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('16: DB role promotion and demotion apply to the next join on the same socket', async () => {
    const u = await makeUser('promote', { roleType: 'kasir', store: storeA.id })
    const sock = await connect(await tokenFor(u, { roleType: 'kasir' }))
    try {
      expect((await joinAck(sock, 'join-store', storeB.id)).ok).toBe(false)
      await db.user.update({ roleType: 'super_admin', userType: 'admin', store: null }, { where: { id: u.id } })
      expect((await joinAck(sock, 'join-store', storeB.id)).ok).toBe(true)
      await db.user.update({ roleType: 'kasir', userType: 'user', store: storeA.id }, { where: { id: u.id } })
      expect((await joinAck(sock, 'join-kitchen', storeB.id)).ok).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('17: DB store scope changes apply to the next join', async () => {
    const u = await makeMember('moveStore', 'store_admin', storeA.id, { roleType: 'admin', userType: 'admin' })
    const sock = await connect(await tokenFor(u, { store: storeA.id }))
    try {
      expect((await joinAck(sock, 'join-store', storeA.id)).ok).toBe(true)
      await db.storeAssignment.update({ storeId: storeB.id }, { where: { userId: u.id } })
      await db.user.update({ store: storeB.id }, { where: { id: u.id } })
      expect((await joinAck(sock, 'join-kitchen', storeB.id)).ok).toBe(true)
      expect((await joinAck(sock, 'join-kitchen', storeA.id)).ok).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('18: the server-side socket identity is hydrated from the DB row', async () => {
    const u = await makeUser('hydrate', { roleType: 'kasir', store: storeA.id })
    const token = await tokenFor(u, { roleType: 'super_admin', store: storeB.id, fullName: 'FORGED' })
    const sock = await connect(token)
    try {
      const s = serverSocketOf(sock)
      expect(s.user.id).toBe(u.id)
      expect(s.user.roleType).toBe('kasir')
      expect(s.user.store).toBe(storeA.id)
      expect(s.user.fullName).toBe(u.fullName)
      expect(s.user.sessionId).toBe(sessionIdOf(token))
    } finally {
      sock.disconnect()
    }
  })
})

describe('P4 joins', () => {
  test('19: an authorized store join succeeds and receives store events', async () => {
    const sock = await connect(await tokenFor(storeAdmin))
    try {
      expect((await joinAck(sock, 'join-store', storeA.id)).ok).toBe(true)
      const p = awaitEvent(sock, 'new-order')
      emitNewOrder(storeA.id, { orderNumber: `${PREFIX}_own` })
      expect(await p).toEqual({ orderNumber: `${PREFIX}_own` })
    } finally {
      sock.disconnect()
    }
  })

  test('20: a cross-store join stays denied', async () => {
    const sock = await connect(await tokenFor(storeAdmin))
    try {
      expect((await joinAck(sock, 'join-store', storeB.id)).ok).toBe(false)
      const p = awaitEvent(sock, 'new-order', 400)
      emitNewOrder(storeB.id, { orderNumber: `${PREFIX}_foreign` })
      expect(await p).toBeNull()
    } finally {
      sock.disconnect()
    }
  })

  test('21: a session revoked after the handshake cannot join', async () => {
    const u = await makeMember('revokedJoin', 'store_admin', storeA.id, { roleType: 'admin', userType: 'admin' })
    const token = await tokenFor(u)
    const sock = await connect(token)
    try {
      // Direct DB revocation (no eviction): the join itself must re-check.
      await mw.revokeContextSession(db, sessionIdOf(token), u.id)
      expect((await joinAck(sock, 'join-store', storeA.id)).ok).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('22: a sessionless token never reaches the join path', async () => {
    await expect(
      connect(jwt.sign({ id: storeAdmin.id, roleType: 'super_admin', store: null }, SECRET))
    ).rejects.toThrow('Unauthorized')
  })

  test('23: reconnecting with a revoked session fails at the handshake', async () => {
    const u = await makeUser('reconnect')
    const token = await tokenFor(u)
    const sock = await connect(token)
    const gone = disconnection(sock)
    expect((await request(app).post('/auth/logout').set(bearer(token))).status).toBe(200)
    expect(await gone).toBe('io server disconnect')
    await expect(connect(token)).rejects.toThrow('Unauthorized')
  })
})

describe('P4 committed revocations disconnect live sockets', () => {
  test('24: logout disconnects that session only; the socket stops receiving', async () => {
    const u = await makeMember('logout', 'store_admin', storeA.id, { roleType: 'admin', userType: 'admin' })
    const token = await tokenFor(u)
    const otherToken = await tokenFor(u)
    const sock = await connect(token)
    const other = await connect(otherToken)
    try {
      expect((await joinAck(sock, 'join-store', storeA.id)).ok).toBe(true)
      const gone = disconnection(sock)
      expect((await request(app).post('/auth/logout').set(bearer(token))).status).toBe(200)
      expect(await gone).toBe('io server disconnect')
      expect(other.connected).toBe(true)
      const p = awaitEvent(sock, 'new-order', 400)
      emitNewOrder(storeA.id, { orderNumber: `${PREFIX}_after_logout` })
      expect(await p).toBeNull()
    } finally {
      sock.disconnect()
      other.disconnect()
    }
  })

  test("25: disable disconnects every socket of the account, not a bystander's", async () => {
    const u = await makeUser('disable')
    const bystander = await makeUser('disableBystander')
    const s1 = await connect(await tokenFor(u))
    const s2 = await connect(await tokenFor(u))
    const b = await connect(await tokenFor(bystander))
    try {
      const gone = Promise.all([disconnection(s1), disconnection(s2)])
      const res = await request(app).put('/auth/change-user-status').set(bearer(adminHttpToken)).send({ id: u.id, status: 'inactive' })
      expect(res.status).toBe(200)
      expect(await gone).toEqual(['io server disconnect', 'io server disconnect'])
      expect(b.connected).toBe(true)
    } finally {
      ;[s1, s2, b].forEach((s) => s.disconnect())
    }
  })

  test('26: soft-delete disconnects the account’s sockets', async () => {
    const u = await makeUser('softDelete')
    const sock = await connect(await tokenFor(u))
    const gone = disconnection(sock)
    expect((await request(app).delete(`/employee/delete-employee/${u.id}`).set(bearer(adminHttpToken))).status).toBe(200)
    expect(await gone).toBe('io server disconnect')
  })

  test('27: password reset disconnects the account’s sockets', async () => {
    const u = await makeUser('reset')
    const sock = await connect(await tokenFor(u))
    const resetToken = crypto.randomBytes(16).toString('hex')
    await db.user.update(
      { resetToken: hashResetToken(resetToken), resetTokenExpires: new Date(Date.now() + 10 * 60 * 1000) },
      { where: { id: u.id } }
    )
    const gone = disconnection(sock)
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: u.email, token: resetToken, newPassword: 'BaruSekali1!', confirmPassword: 'BaruSekali1!' })
    expect(res.status).toBe(200)
    expect(await gone).toBe('io server disconnect')
  })

  test("28: an admin password change disconnects the target's sockets, not the admin's", async () => {
    const u = await makeUser('adminPw')
    const target = await connect(await tokenFor(u))
    const adminSock = await connect(adminHttpToken)
    try {
      const gone = disconnection(target)
      const res = await request(app)
        .put('/employee/edit-employee')
        .set(bearer(adminHttpToken))
        .send({ id: u.id, password: 'GantiAdmin1!', confirmPassword: 'GantiAdmin1!' })
      expect(res.status).toBe(200)
      expect(await gone).toBe('io server disconnect')
      expect(adminSock.connected).toBe(true)
    } finally {
      target.disconnect()
      adminSock.disconnect()
    }
  })

  test('29: a rolled-back revocation disconnects nothing', async () => {
    const u = await makeUser('rollback')
    const sock = await connect(await tokenFor(u))
    try {
      jest.spyOn(console, 'error').mockImplementation(() => {})
      jest.spyOn(db.authorizationContextSession, 'update').mockRejectedValueOnce(new Error('revoke failed'))
      const gone = disconnection(sock, 600)
      const res = await request(app).put('/auth/change-user-status').set(bearer(adminHttpToken)).send({ id: u.id, status: 'inactive' })
      expect(res.status).toBe(500)
      expect(await gone).toBeNull()
      expect(sock.connected).toBe(true)
      expect((await db.user.findByPk(u.id)).disabledAt).toBeNull()
    } finally {
      sock.disconnect()
    }
  })

  test('30: repeated revocation is harmless and stays revoked', async () => {
    const u = await makeUser('repeat')
    const token = await tokenFor(u)
    const sock = await connect(token)
    const gone = disconnection(sock)
    const first = await request(app).put('/auth/change-user-status').set(bearer(adminHttpToken)).send({ id: u.id, status: 'inactive' })
    const second = await request(app).put('/auth/change-user-status').set(bearer(adminHttpToken)).send({ id: u.id, status: 'inactive' })
    expect([first.status, second.status]).toEqual([200, 200])
    expect(await gone).toBe('io server disconnect')
    expect(() => disconnectSession(sessionIdOf(token))).not.toThrow()
    await db.user.update({ disabledAt: null }, { where: { id: u.id } })
    await expect(connect(token)).rejects.toThrow('Unauthorized')
  })
})

describe('P4 races resolve toward revocation', () => {
  test('a revocation landing between session check and room join denies the join', async () => {
    const u = await makeMember('raceJoin', 'store_admin', storeA.id, { roleType: 'admin', userType: 'admin' })
    const token = await tokenFor(u)
    const sock = await connect(token)
    try {
      const realLoad = mw.loadContextSession
      jest.spyOn(mw, 'loadContextSession').mockImplementationOnce(async (...args) => {
        await mw.revokeContextSession(db, sessionIdOf(token), u.id)
        return realLoad(...args)
      })
      expect((await joinAck(sock, 'join-store', storeA.id)).ok).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('a revocation committed after the handshake check but before registration still disconnects', async () => {
    const u = await makeUser('raceHandshake')
    const token = await tokenFor(u)
    const sid = sessionIdOf(token)
    const realFindOne = db.authorizationContextSession.findOne.bind(db.authorizationContextSession)
    jest.spyOn(db.authorizationContextSession, 'findOne').mockImplementationOnce(async (...args) => {
      const row = await realFindOne(...args)
      // Revoke and evict while the handshake is still in flight: eviction
      // finds no registered socket, so the post-registration re-check must.
      await mw.revokeContextSession(db, sid, u.id)
      disconnectSession(sid)
      return row
    })
    const sock = await connect(token)
    expect(await disconnection(sock)).toBe('io server disconnect')
  })

  test('a handshake racing a disable never leaves a live socket', async () => {
    for (let i = 0; i < 3; i++) {
      const u = await makeUser(`raceDisable${i}`)
      const token = await tokenFor(u)
      const [conn, res] = await Promise.all([
        connect(token).catch(() => null),
        request(app).put('/auth/change-user-status').set(bearer(adminHttpToken)).send({ id: u.id, status: 'inactive' })
      ])
      expect(res.status).toBe(200)
      if (conn) {
        const reason = await disconnection(conn)
        expect(reason).not.toBeNull()
      }
    }
  })

  test('a handshake racing a password change never leaves a live socket', async () => {
    for (let i = 0; i < 3; i++) {
      const u = await makeUser(`racePw${i}`)
      const token = await tokenFor(u)
      const [conn, res] = await Promise.all([
        connect(token).catch(() => null),
        request(app)
          .put('/employee/edit-employee')
          .set(bearer(adminHttpToken))
          .send({ id: u.id, password: `Ganti${i}Race!`, confirmPassword: `Ganti${i}Race!` })
      ])
      expect(res.status).toBe(200)
      if (conn) {
        const reason = await disconnection(conn)
        expect(reason).not.toBeNull()
      }
    }
  })
})

describe('P4 open decisions — current safe boundary (not policy)', () => {
  // OPEN DECISION (AUTH-1 P4): users without a tenant membership are
  // authorized over HTTP from their DB role/store (P2), but the canonical
  // socket join requires a membership. Until decided, the socket keeps the
  // narrower canonical boundary rather than broadening it.
  test('a legacy store admin without a membership cannot join its store room', async () => {
    const sock = await connect(await tokenFor(admin))
    try {
      expect((await joinAck(sock, 'join-store', storeA.id)).ok).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  // OPEN DECISION (AUTH-1 P4): the canonical join accepts numeric store ids
  // only, so the super_admin "All Stores" KDS room is not joinable.
  test('a global super_admin cannot currently join the "all" kitchen room', async () => {
    const superGlobal = await makeUser('superGlobal', { roleType: 'super_admin', userType: 'admin', store: null })
    const sock = await connect(await tokenFor(superGlobal))
    try {
      expect((await joinAck(sock, 'join-kitchen', 'all')).ok).toBe(false)
      expect((await joinAck(sock, 'join-kitchen', storeB.id)).ok).toBe(true)
    } finally {
      sock.disconnect()
    }
  })
})
