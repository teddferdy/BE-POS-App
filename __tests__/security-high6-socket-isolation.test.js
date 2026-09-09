process.env.NODE_ENV = 'test'

const http = require('http')
const jwt = require('jsonwebtoken')
const { io: socketClient } = require('socket.io-client')
const { initSocket, getIO } = require('../api/service/socket')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 2 HIGH-6 regression tests: the socket.IO realtime namespace had no
// handshake authentication and join-kitchen/join-store blindly joined the
// room derived from whatever storeId the client sent, so any anonymous
// client could join another tenant's kitchen/store room and receive live
// order payloads, and join-store([6]) (array coercion) joined store 6.
// Assertions fire a real Socket.IO server + client so room membership,
// event delivery, and notification broadcast isolation are all verified.

let server = null
let port = null
let store1 = null
let store2 = null
let adminAToken = null
let adminBToken = null
let superToken = null

const baseUrl = () => `http://127.0.0.1:${port}`
const sockOpts = {
  transports: ['websocket'],
  reconnection: false,
  timeout: 3000
}

const connect = (token, extra = {}) =>
  new Promise((resolve, reject) => {
    const sock = socketClient(baseUrl(), {
      ...sockOpts,
      ...extra,
      auth: token ? { token } : {}
    })
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

const expectConnectError = (token) =>
  new Promise((resolve) => {
    const sock = socketClient(baseUrl(), {
      ...sockOpts,
      auth: token ? { token } : {}
    })
    const timer = setTimeout(() => {
      try { sock.disconnect() } catch {}
      resolve({ connected: false, message: 'timeout' })
    }, 4000)
    sock.on('connect', () => {
      clearTimeout(timer)
      try { sock.disconnect() } catch {}
      resolve({ connected: true, message: null })
    })
    sock.on('connect_error', (err) => {
      clearTimeout(timer)
      resolve({ connected: false, message: err && err.message })
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

const awaitEvent = (sock, event, ms = 600) =>
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
  store1 = await db.location.create({ name: 'SOCK6_STORE_A', status: 'active' })
  store2 = await db.location.create({ name: 'SOCK6_STORE_B', status: 'active' })

  adminAToken = jwt.sign(
    { id: 9601, userName: 'sock6_admin_a', roleType: 'admin', store: store1.id },
    JWT_SECRET
  )
  adminBToken = jwt.sign(
    { id: 9602, userName: 'sock6_admin_b', roleType: 'admin', store: store2.id },
    JWT_SECRET
  )
  superToken = jwt.sign(
    { id: 9600, userName: 'sock6_super', roleType: 'super_admin' },
    JWT_SECRET
  )

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
  await db.location.destroy({
    where: { id: [store1?.id, store2?.id].filter(Boolean) },
    force: true
  })
})

describe('HIGH-6 socket handshake authentication', () => {
  test('connection without a token is rejected', async () => {
    const res = await expectConnectError(null)
    expect(res.connected).toBe(false)
    expect(res.message).toMatch(/authen/i)
  })

  test('connection with a garbage/invalid token is rejected', async () => {
    const res = await expectConnectError('not-a-real-token')
    expect(res.connected).toBe(false)
  })

  test('connection with a token signed by the wrong secret is rejected', async () => {
    const forged = jwt.sign(
      { id: 1, userName: 'x', roleType: 'admin', store: store1.id },
      'wrong-secret'
    )
    const res = await expectConnectError(forged)
    expect(res.connected).toBe(false)
  })

  test('store admin can join and receive their own store kitchen/store rooms', async () => {
    const sock = await connect(adminAToken)
    try {
      const kitchenAck = await joinAck(sock, 'join-kitchen', store1.id)
      const storeAck = await joinAck(sock, 'join-store', store1.id)
      expect(kitchenAck && kitchenAck.ok).toBe(true)
      expect(storeAck && storeAck.ok).toBe(true)

      const rooms = getIO().of('/').adapter.rooms
      expect(rooms.has(`kitchen-${store1.id}`)).toBe(true)
      expect(rooms.has(`store-${store1.id}`)).toBe(true)

      const kitchenP = awaitEvent(sock, 'kitchen-ping')
      getIO().of('/').to(`kitchen-${store1.id}`).emit('kitchen-ping', { n: 1 })
      expect(await kitchenP).toEqual({ n: 1 })

      const storeP = awaitEvent(sock, 'store-ping')
      getIO().of('/').to(`store-${store1.id}`).emit('store-ping', { n: 2 })
      expect(await storeP).toEqual({ n: 2 })
    } finally {
      sock.disconnect()
    }
  })

  test('store admin joining a FOREIGN kitchen/store room is rejected', async () => {
    const sock = await connect(adminAToken)
    try {
      const kitchenRej = joinRejected(sock)
      const kitchenAck = await joinAck(sock, 'join-kitchen', store2.id)
      expect(kitchenAck && kitchenAck.ok).toBe(false)
      expect(await kitchenRej).toMatchObject({ event: 'join-kitchen', ok: false })

      const storeRej = joinRejected(sock)
      const storeAck = await joinAck(sock, 'join-store', store2.id)
      expect(storeAck && storeAck.ok).toBe(false)
      expect(await storeRej).toMatchObject({ event: 'join-store', ok: false })

      const rooms = getIO().of('/').adapter.rooms
      expect(rooms.has(`kitchen-${store2.id}`)).toBe(false)
      expect(rooms.has(`store-${store2.id}`)).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('foreign store broadcasts never reach a store admin socket', async () => {
    const sock = await connect(adminAToken)
    try {
      await joinAck(sock, 'join-kitchen', store1.id)
      await joinAck(sock, 'join-store', store1.id)
      await joinAck(sock, 'join-kitchen', store2.id)
      await joinAck(sock, 'join-store', store2.id)

      const listenerP = awaitEvent(sock, 'foreign-order', 500)
      await getIO().of('/').to(`kitchen-${store2.id}`).emit('foreign-order', {
        orderNumber: 'SECRET-STORE2'
      })
      await getIO().of('/').to(`store-${store2.id}`).emit('foreign-order', {
        orderNumber: 'SECRET-STORE2-B'
      })
      expect(await listenerP).toBeNull()
    } finally {
      sock.disconnect()
    }
  })

  test('attempting foreign joins does not poison the session own-store join', async () => {
    const sock = await connect(adminAToken)
    try {
      await joinAck(sock, 'join-kitchen', store2.id)
      const ownAck = await joinAck(sock, 'join-kitchen', store1.id)
      expect(ownAck && ownAck.ok).toBe(true)

      const p = awaitEvent(sock, 'still-receives', 600)
      getIO().of('/').to(`kitchen-${store1.id}`).emit('still-receives', { ok: 1 })
      expect(await p).toEqual({ ok: 1 })
    } finally {
      sock.disconnect()
    }
  })

  test('super_admin can join any store room (intentional global access)', async () => {
    const sock = await connect(superToken)
    try {
      const ack = await joinAck(sock, 'join-kitchen', store2.id)
      expect(ack && ack.ok).toBe(true)

      const p = awaitEvent(sock, 'super-ping', 600)
      getIO().of('/').to(`kitchen-${store2.id}`).emit('super-ping', { n: 9 })
      expect(await p).toEqual({ n: 9 })
    } finally {
      sock.disconnect()
    }
  })

  test('spoofed storeId payload shapes cannot grant a foreign store room', async () => {
    const sock = await connect(adminAToken)
    try {
      const payloads = [
        { value: store2.id, label: 'number' },
        { value: [store2.id], label: 'array' },
        { value: String(store2.id), label: 'string' },
        { value: { id: store2.id }, label: 'object-id' },
        { value: { store: store2.id }, label: 'object-store' }
      ]
      for (const { value } of payloads) {
        const rej = joinRejected(sock)
        const ack = await joinAck(sock, 'join-kitchen', value)
        expect(ack && ack.ok).toBe(false)
        expect(await rej).toMatchObject({ ok: false })
      }

      const rooms = getIO().of('/').adapter.rooms
      expect(rooms.has(`kitchen-${store2.id}`)).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('another store admin cannot join the first store room either', async () => {
    const sock = await connect(adminBToken)
    try {
      const ack = await joinAck(sock, 'join-store', store1.id)
      expect(ack && ack.ok).toBe(false)
      expect(getIO().of('/').adapter.rooms.has(`store-${store1.id}`)).toBe(false)
    } finally {
      sock.disconnect()
    }
  })

  test('notification broadcast for store A does not leak to store B socket', async () => {
    const sockA = await connect(adminAToken)
    const sockB = await connect(adminBToken)
    try {
      await joinAck(sockA, 'join-store', store1.id)
      await joinAck(sockB, 'join-store', store2.id)

      const leakP = awaitEvent(sockB, 'new-notification-global', 500)
      const legitP = awaitEvent(sockA, 'new-notification-global', 500)
      const { emitNotification } = require('../api/service/socket')
      emitNotification(store1.id, { title: 'Secret A notification' })

      expect(await leakP).toBeNull()
      expect(await legitP).toEqual({ title: 'Secret A notification' })
    } finally {
      sockA.disconnect()
      sockB.disconnect()
    }
  })
})