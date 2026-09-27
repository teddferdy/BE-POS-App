process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const http = require('http')
const jwt = require('jsonwebtoken')
const { io: socketClient } = require('socket.io-client')
const { initSocket, getIO, emitNewOrder } = require('../api/service/socket')
const app = require('../api/index')
const request = require('supertest')
const db = require('../db/models')

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
  storeA = await db.location.create({ name: unique('STORE_A'), status: 'active' })
  storeB = await db.location.create({ name: unique('STORE_B'), status: 'active' })
  adminA = await makeUser('adminA', { roleType: 'admin', userType: 'admin' })
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
    await db.authorizationContextSession.destroy({ where: { userId: ids }, force: true }).catch(() => {})
    await db.user.destroy({ where: { id: ids }, force: true }).catch(() => {})
  }
  await db.location.destroy({ where: { id: [storeA?.id, storeB?.id].filter(Boolean) }, force: true }).catch(() => {})
})

const adminTok = () => sign({ id: adminA.id, roleType: 'admin', store: storeA.id })
const superTok = () => sign({ id: superGlobal.id, roleType: 'super_admin', store: null })

describe('P1-5 handshake account-state gate', () => {
  test('enabled real user connects', async () => {
    const sock = await connect(adminTok())
    try {
      expect(sock.connected).toBe(true)
    } finally {
      sock.disconnect()
    }
  })

  test('disabled user handshake rejected with Unauthorized convention', async () => {
    await db.user.update({ disabledAt: new Date() }, { where: { id: adminA.id } })
    try {
      await expect(connect(adminTok())).rejects.toThrow('Unauthorized')
    } finally {
      await db.user.update({ disabledAt: null }, { where: { id: adminA.id } })
    }
  })

  test('soft-deleted user handshake rejected', async () => {
    const u = await makeUser('gone', {})
    const tok = sign({ id: u.id, roleType: 'user', store: storeA.id })
    await db.user.destroy({ where: { id: u.id } })
    await expect(connect(tok)).rejects.toThrow('Unauthorized')
  })

  test('missing user handshake rejected', async () => {
    const tok = sign({ id: 2147480000, roleType: 'admin', store: storeA.id })
    await expect(connect(tok)).rejects.toThrow('Unauthorized')
  })
})

describe('P1-5 sessionless join account-state gate', () => {
  test('enabled join follows existing role/store rules', async () => {
    const sock = await connect(adminTok())
    try {
      expect((await joinAck(sock, 'join-store', storeA.id) || {}).ok).toBe(true)
    } finally {
      sock.disconnect()
    }
  })

  test('disabled sessionless join rejected via existing join path', async () => {
    const sock = await connect(adminTok())
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

  test('missing sessionless join rejected', async () => {
    // Handshake itself rejects missing users; a socket can therefore never
    // reach the join path without a real row. This asserts that layer.
    const tok = sign({ id: 2147480001, roleType: 'admin', store: storeA.id })
    await expect(connect(tok)).rejects.toThrow('Unauthorized')
  })
})

describe('P1-5 session-backed regression (canonical inheritance)', () => {
  test('enabled session-backed join preserved; disabled rejected', async () => {
    // Full canonical flow: dedicated member user so context selection
    // resolves (login → select tenant → select store → socket join).
    const tenant = await db.tenant.create({ code: unique('tn'), name: unique('Tenant') })
    const sessUser = await makeUser('sessU', { roleType: 'user', userType: 'user' })
    await db.location.update({ tenantId: tenant.id }, { where: { id: storeA.id } })
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
      await db.location.update({ tenantId: null }, { where: { id: storeA.id } }).catch(() => {})
      await db.tenant.destroy({ where: { id: tenant.id }, force: true }).catch(() => {})
    }
  })
})

describe('P1-5 super-admin ordering', () => {
  test('enabled global super-admin keeps global access', async () => {
    const sock = await connect(superTok())
    try {
      expect((await joinAck(sock, 'join-store', storeB.id) || {}).ok).toBe(true)
    } finally {
      sock.disconnect()
    }
  })

  test('disabled global super-admin denied at handshake', async () => {
    await db.user.update({ disabledAt: new Date() }, { where: { id: superGlobal.id } })
    try {
      await expect(connect(superTok())).rejects.toThrow('Unauthorized')
    } finally {
      await db.user.update({ disabledAt: null }, { where: { id: superGlobal.id } })
    }
  })
})

describe('P1-5 accepted tenure limitation (documented)', () => {
  test('already-joined socket keeps receiving after disable (no eviction)', async () => {
    const sock = await connect(adminTok())
    try {
      expect((await joinAck(sock, 'join-store', storeA.id) || {}).ok).toBe(true)
      await db.user.update({ disabledAt: new Date() }, { where: { id: adminA.id } })
      const p = awaitEvent(sock, 'new-order', 600)
      emitNewOrder(storeA.id, { orderNumber: `${PREFIX}_tenure` })
      const evt = await p
      // Accepted P1-5 limitation: existing membership/delivery is not
      // retroactively revoked. This test documents, not endorses, it.
      expect(evt).not.toBeNull()
      expect(sock.connected).toBe(true)
    } finally {
      await db.user.update({ disabledAt: null }, { where: { id: adminA.id } })
      sock.disconnect()
    }
  })
})
