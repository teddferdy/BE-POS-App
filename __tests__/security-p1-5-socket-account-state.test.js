process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const http = require('http')
const jwt = require('jsonwebtoken')
const { io: socketClient } = require('socket.io-client')
const { initSocket, getIO, emitNewOrder } = require('../api/service/socket')
const app = require('../api/index')
const request = require('supertest')
const db = require('../db/models')
const { signSessionToken } = require('../test-helpers/authSession')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'
const PREFIX = `p15_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
let seq = 0
const unique = (key) => `${PREFIX}_${key}_${++seq}`.toLowerCase()
const sign = (claims) => jwt.sign(claims, JWT_SECRET)
const bearer = (token) => ({ Authorization: `Bearer ${token}` })
const PASSWORD = 'Rahasia123!'

const sockOpts = { transports: ['websocket'], reconnection: false, timeout: 3000 }

let server = null
let port = null
let tenant = null
let storeA = null
let storeB = null
const createdUserIds = []
let adminA = null
let superGlobal = null

const baseUrl = () => `http://127.0.0.1:${port}`

const connect = (token) =>
  new Promise((resolve, reject) => {
    const sock = socketClient(baseUrl(), { ...sockOpts, auth: token ? { token } : {} })
    const timer = setTimeout(() => {
      sock.disconnect()
      reject(new Error('socket connect timeout'))
    }, 2500)
    sock.on('connect', () => {
      clearTimeout(timer)
      resolve(sock)
    })
    sock.on('connect_error', (err) => {
      clearTimeout(timer)
      err.socket = sock
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

const joinRejected = (sock) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 1500)
    sock.on('join-rejected', (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })

const awaitEvent = (sock, event, ms = 800) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    sock.on(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })

const makeUser = async (key, attrs) => {
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

beforeAll(async () => {
  // AUTH-1 P4: sockets are session-backed and store joins canonical (DR-12),
  // so adminA is a tenant member assigned to storeA.
  tenant = await db.tenant.create({ code: unique('tn'), name: unique('Tenant') })
  storeA = await db.location.create({ name: unique('STORE_A'), status: 'active', tenantId: tenant.id })
  storeB = await db.location.create({ name: unique('STORE_B'), status: 'active', tenantId: tenant.id })
  adminA = await makeUser('adminA', { roleType: 'admin', userType: 'admin' })
  await db.tenantMembership.create({ userId: adminA.id, tenantId: tenant.id, role: 'store_admin', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: adminA.id, tenantId: tenant.id, storeId: storeA.id })
  superGlobal = await makeUser('superG', { roleType: 'super_admin', userType: 'admin', store: null })

  server = http.createServer()
  initSocket(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = server.address().port
})

afterAll(async () => {
  const sio = getIO()
  if (sio) {
    await new Promise((resolve) => {
      sio.close(() => resolve())
      setTimeout(resolve, 1500)
    })
  }
  if (server && server.listening) {
    await new Promise((resolve) => server.close(resolve))
  }
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

// Session-bound credentials (AUTH-1 P4); `sign` remains only for explicit
// negative cases that a session can never back.
const adminTok = () => signSessionToken({ id: adminA.id }, JWT_SECRET)
const superTok = () => signSessionToken({ id: superGlobal.id }, JWT_SECRET)

describe('P1-5 handshake account-state gate', () => {
  test('enabled real user connects', async () => {
    const sock = await connect(await adminTok())
    try {
      expect(sock.connected).toBe(true)
    } finally {
      sock.disconnect()
    }
  })

  test('disabled user handshake rejected with Unauthorized convention', async () => {
    await db.user.update({ disabledAt: new Date() }, { where: { id: adminA.id } })
    try {
      await expect(connect(await adminTok())).rejects.toThrow('Unauthorized')
    } finally {
      await db.user.update({ disabledAt: null }, { where: { id: adminA.id } })
    }
  })

  test('soft-deleted user handshake rejected', async () => {
    const u = await makeUser('gone', {})
    const tok = await signSessionToken({ id: u.id }, JWT_SECRET)
    await db.user.destroy({ where: { id: u.id } })
    await expect(connect(tok)).rejects.toThrow('Unauthorized')
  })

  test('missing user handshake rejected', async () => {
    const tok = sign({ id: 2147480000, roleType: 'admin', store: storeA.id })
    await expect(connect(tok)).rejects.toThrow('Unauthorized')
  })
})

describe('P1-5 join account-state gate (canonical, AUTH-1 P4)', () => {
  test('enabled join follows canonical membership/assignment rules', async () => {
    const sock = await connect(await adminTok())
    try {
      expect((await joinAck(sock, 'join-store', storeA.id) || {}).ok).toBe(true)
    } finally {
      sock.disconnect()
    }
  })

  test('account disabled after the handshake: join rejected by the canonical join path', async () => {
    const sock = await connect(await adminTok())
    try {
      await db.user.update({ disabledAt: new Date() }, { where: { id: adminA.id } })
      const rej = joinRejected(sock)
      const ack = await joinAck(sock, 'join-store', storeA.id)
      expect(ack && ack.ok).toBe(false)
      expect(await rej).toMatchObject({ event: 'join-store', ok: false })
    } finally {
      await db.user.update({ disabledAt: null }, { where: { id: adminA.id } })
      sock.disconnect()
    }
  })

  test('a sessionless token for a missing user is rejected at the handshake', async () => {
    // Handshake itself rejects missing users; a socket can therefore never
    // reach the join path without a real row. This asserts that layer.
    const tok = sign({ id: 2147480001, roleType: 'admin', store: storeA.id })
    await expect(connect(tok)).rejects.toThrow('Unauthorized')
  })
})

describe('P1-5 session-backed regression (canonical inheritance)', () => {
  test('enabled session-backed join preserved; disabled rejected', async () => {
    // Full canonical flow: dedicated member user so context selection
    // resolves (login → select tenant → select store → socket join). Uses
    // the suite tenant that storeA already belongs to.
    const sessUser = await makeUser('sessU', { roleType: 'user', userType: 'user' })
    await db.tenantMembership.create({ userId: sessUser.id, tenantId: tenant.id, role: 'store_admin', status: 'ACTIVE' })
    await db.storeAssignment.create({ userId: sessUser.id, tenantId: tenant.id, storeId: storeA.id })
    try {
      const login = await request(app).post('/auth/login').send({ userName: sessUser.userName, password: PASSWORD })
      expect(login.status).toBe(200)
      const t = login.body.token
      expect(
        (await request(app).post('/auth/context/tenant').set(bearer(t)).send({ tenantId: tenant.id })).status
      ).toBe(200)
      expect(
        (await request(app).post('/auth/context/store').set(bearer(t)).send({ storeId: storeA.id })).status
      ).toBe(200)

      const sock = await connect(t)
      try {
        // Session-backed path resolves canonical context; enabled works.
        const ack = await joinAck(sock, 'join-store', storeA.id)
        expect(ack && ack.ok).toBe(true)
      } finally {
        sock.disconnect()
      }

      await db.user.update({ disabledAt: new Date() }, { where: { id: sessUser.id } })
      try {
        // Disabled session-backed credential is denied (handshake gate).
        await expect(connect(t)).rejects.toThrow('Unauthorized')
      } finally {
        await db.user.update({ disabledAt: null }, { where: { id: sessUser.id } })
      }
    } finally {
      await db.storeAssignment.destroy({ where: { userId: sessUser.id }, force: true }).catch(() => {})
      await db.tenantMembership.destroy({ where: { userId: sessUser.id }, force: true }).catch(() => {})
    }
  })
})

describe('P1-5 super-admin ordering', () => {
  test('enabled global super-admin keeps global access', async () => {
    const sock = await connect(await superTok())
    try {
      expect((await joinAck(sock, 'join-store', storeB.id) || {}).ok).toBe(true)
    } finally {
      sock.disconnect()
    }
  })

  test('disabled global super-admin denied at handshake', async () => {
    await db.user.update({ disabledAt: new Date() }, { where: { id: superGlobal.id } })
    try {
      await expect(connect(await superTok())).rejects.toThrow('Unauthorized')
    } finally {
      await db.user.update({ disabledAt: null }, { where: { id: superGlobal.id } })
    }
  })
})

// Eviction is event-driven (AUTH-1 P4): the canonical disable operation
// disconnects live sockets after its commit (auth-p4 suite). A direct
// `disabledAt` write bypasses that operation, so nothing evicts here — this
// pins that sockets are not polled, it does not endorse the bypass.
describe('P1-5 direct DB writes do not evict (eviction is event-driven)', () => {
  test('already-joined socket keeps receiving after a direct disabledAt write', async () => {
    const sock = await connect(await adminTok())
    try {
      expect((await joinAck(sock, 'join-store', storeA.id) || {}).ok).toBe(true)
      await db.user.update({ disabledAt: new Date() }, { where: { id: adminA.id } })
      const p = awaitEvent(sock, 'new-order', 600)
      emitNewOrder(storeA.id, { orderNumber: `${PREFIX}_tenure` })
      const evt = await p
      expect(evt).not.toBeNull()
      expect(sock.connected).toBe(true)
    } finally {
      await db.user.update({ disabledAt: null }, { where: { id: adminA.id } })
      sock.disconnect()
    }
  })
})
