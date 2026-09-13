process.env.NODE_ENV = 'test'

const http = require('http')
const jwt = require('jsonwebtoken')
const { io: socketClient } = require('socket.io-client')
const { initSocket, getIO, emitNewOrder, emitItemStatusUpdate } = require('../api/service/socket')
const db = require('../db/models')

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
// isolation (canJoinStore / guardedJoin) were already correct and are only
// re-asserted here as regression guards, not as bug reproductions — they are
// expected to pass both before and after the fix.

let server = null
let port = null
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
  store1 = await db.location.create({ name: 'KDSALL_STORE_A', status: 'active' })
  store2 = await db.location.create({ name: 'KDSALL_STORE_B', status: 'active' })

  adminToken = jwt.sign(
    { id: 9801, userName: 'kdsall_admin', roleType: 'admin', store: store1.id },
    JWT_SECRET
  )
  superToken = jwt.sign({ id: 9800, userName: 'kdsall_super', roleType: 'super_admin' }, JWT_SECRET)

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
  await db.location.destroy({ where: { id: [store1?.id, store2?.id].filter(Boolean) }, force: true })
})

describe('KDS All Stores realtime delivery (P0)', () => {
  test('super_admin viewing All Stores receives a new-order event for ANY store', async () => {
    const sock = await connect(superToken)
    try {
      const ack = await joinAck(sock, 'join-kitchen', 'all')
      expect(ack && ack.ok).toBe(true)

      const p = awaitEvent(sock, 'new-order')
      emitNewOrder(store1.id, { orderNumber: 'KDSALL-ORDER-1' })
      const received = await p
      expect(received).toEqual({ orderNumber: 'KDSALL-ORDER-1' })
    } finally {
      sock.disconnect()
    }
  })

  test('super_admin viewing All Stores receives an item-status-updated event for ANY store', async () => {
    const sock = await connect(superToken)
    try {
      await joinAck(sock, 'join-kitchen', 'all')

      const p = awaitEvent(sock, 'item-status-updated')
      emitItemStatusUpdate(store2.id, 123, { id: 456, status: 'preparing' })
      const received = await p
      expect(received).toEqual({ orderId: 123, item: { id: 456, status: 'preparing' } })
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
  // 'all' as its storeId — canJoinStore's numeric comparison naturally
  // rejects it (Number('all') is NaN).
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
