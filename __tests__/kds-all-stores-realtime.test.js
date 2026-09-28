process.env.NODE_ENV = 'test'

const http = require('http')
const { io: socketClient } = require('socket.io-client')
const { initSocket, getIO, emitNewOrder, emitItemStatusUpdate } = require('../api/service/socket')
const db = require('../db/models')
const { signSessionToken } = require('../test-helpers/authSession')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 12 Batch 2 (P0): a super_admin's "All Stores" KDS view joins the
// `kitchen-all` room (FE emits join-kitchen('all') when no specific store is
// selected — see src/page/kitchen-display/index.jsx), but emitToKitchen only
// ever broadcast to `kitchen-${storeId}` with a real numeric store id, never
// to `kitchen-all`. Realtime kitchen events never reached that view, and
// because the socket itself was `connected: true`, the FE's disconnected-only
// polling fallback never kicked in either — the board froze silently.
//
// This is a REALTIME-DELIVERY bug only. Store-scoped REST authorization
// (validateStoreAccess / getKitchenOrders) and per-store socket room
// isolation (guardedJoin, canonical since AUTH-1 P4) were already correct and are only
// re-asserted here as regression guards, not as bug reproductions — they are
// expected to pass both before and after the fix.

let server = null
let port = null
let tenant = null
let store1 = null
let store2 = null
let adminToken = null
let superToken = null

const baseUrl = () => `http://127.0.0.1:${port}`
const sockOpts = { transports: ['websocket'], reconnection: false, timeout: 3000 }

const connect = (token) =>
  new Promise((resolve, reject) => {
    const sock = socketClient(baseUrl(), { ...sockOpts, auth: token ? { token } : {} })
    const timer = setTimeout(() => {
      try { sock.disconnect() } catch {}
      reject(new Error('socket connect timeout'))
    }, 4000)
    sock.on('connect', () => {
      clearTimeout(timer)
      resolve(sock)
    })
    sock.on('connect_error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })

const joinAck = (sock, event, storeId) =>
  new Promise((resolve) => {
    sock.emit(event, storeId, (ack) => resolve(ack))
  })

const joinRejected = (sock) =>
  new Promise((resolve) => {
    const onRej = (data) => {
      sock.off('join-rejected', onRej)
      resolve(data)
    }
    sock.on('join-rejected', onRej)
    setTimeout(() => resolve(null), 2000)
  })

const awaitEvent = (sock, event, ms = 800) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      sock.off(event, onEvt)
      resolve(null)
    }, ms)
    const onEvt = (data) => {
      clearTimeout(timer)
      resolve(data)
    }
    sock.on(event, onEvt)
  })

beforeAll(async () => {
  // AUTH-1 P4: sockets are session-backed and store joins canonical (DR-12),
  // so the store admin is a tenant member assigned to store1.
  tenant = await db.tenant.create({ code: `KDSALL_TN_${Date.now()}`, name: 'KDSALL Tenant' })
  store1 = await db.location.create({ name: 'KDSALL_STORE_A', status: 'active', tenantId: tenant.id })
  store2 = await db.location.create({ name: 'KDSALL_STORE_B', status: 'active', tenantId: tenant.id })

  for (const [id, userName, roleType, userType, store] of [
    [9801, 'kdsall_admin', 'admin', 'admin', store1.id],
    [9800, 'kdsall_super', 'super_admin', 'admin', null]
  ]) {
    await db.user.create({
      id,
      userName,
      email: `p14-${id}-kdsall@test.com`,
      roleType,
      userType,
      store,
      status: 'active',
      fullName: userName
    })
  }
  await db.tenantMembership.create({ userId: 9801, tenantId: tenant.id, role: 'store_admin', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: 9801, tenantId: tenant.id, storeId: store1.id })
  adminToken = await signSessionToken({ id: 9801, userName: 'kdsall_admin' }, JWT_SECRET)
  superToken = await signSessionToken({ id: 9800, userName: 'kdsall_super' }, JWT_SECRET)

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
  await db.storeAssignment.destroy({ where: { userId: 9801 }, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: { userId: 9801 }, force: true }).catch(() => {})
  await db.user.destroy({ where: { id: [9801, 9800] }, force: true })
  await db.location.destroy({ where: { id: [store1?.id, store2?.id].filter(Boolean) }, force: true })
  await db.tenant.destroy({ where: { id: tenant?.id }, force: true }).catch(() => {})
})

describe('KDS All Stores realtime delivery (P0)', () => {
  // OPEN DECISION (AUTH-1 P4): the canonical socket join accepts numeric
  // store ids only, so a session-backed super_admin cannot currently join
  // the "all" room (the FE KDS falls back to polling). This pins the current
  // boundary; it is not a policy decision.
  test('OPEN DECISION: a session-backed super_admin cannot currently join the "all" kitchen room', async () => {
    const sock = await connect(superToken)
    try {
      const ack = await joinAck(sock, 'join-kitchen', 'all')
      expect(ack && ack.ok).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  // The P0 fan-out itself is unchanged: every store's kitchen events are
  // mirrored to `kitchen-all`. Room membership is placed server-side here —
  // deliberately bypassing join authorization — to test only the broadcast.
  test('kitchen events of ANY store are mirrored to the kitchen-all room', async () => {
    const sock = await connect(superToken)
    try {
      getIO().of('/').sockets.get(sock.id).join('kitchen-all')

      const orderP = awaitEvent(sock, 'new-order')
      emitNewOrder(store1.id, { orderNumber: 'KDSALL-ORDER-1' })
      expect(await orderP).toEqual({ orderNumber: 'KDSALL-ORDER-1' })

      const itemP = awaitEvent(sock, 'item-status-updated')
      emitItemStatusUpdate(store2.id, 123, { id: 456, status: 'preparing' })
      expect(await itemP).toEqual({ orderId: 123, item: { id: 456, status: 'preparing' } })
    } finally {
      sock.disconnect()
    }
  })

  test('a store-scoped viewer does not receive duplicate/leaked "all" broadcasts meant for other stores', async () => {
    const sock = await connect(adminToken)
    try {
      await joinAck(sock, 'join-kitchen', store1.id)

      const p = awaitEvent(sock, 'new-order', 500)
      emitNewOrder(store2.id, { orderNumber: 'KDSALL-FOREIGN-ORDER' })
      expect(await p).toBeNull()
    } finally {
      sock.disconnect()
    }
  })

  // Regression guard (already correct, not part of this bug): a non-super
  // socket can never join the "all" room by sending the literal string
  // 'all' as its storeId — the canonical join accepts numeric store ids only and
  // so rejects it (Number('all') is NaN).
  test('a store-scoped admin cannot join the "all" kitchen room', async () => {
    const sock = await connect(adminToken)
    try {
      const rej = joinRejected(sock)
      const ack = await joinAck(sock, 'join-kitchen', 'all')
      expect(ack && ack.ok).toBe(false)
      expect(await rej).toMatchObject({ event: 'join-kitchen', ok: false })

      const rooms = getIO().of('/').adapter.rooms
      expect(rooms.has('kitchen-all')).toBe(false)
    } finally {
      sock.disconnect()
    }
  })
})
