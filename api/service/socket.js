const { Server } = require('socket.io')
// ponytail: pakai kebijakan origin yang sama dengan Express REST
const { corsOriginCheck } = require('../utils/corsOptions')
const userContext = require('../../utils/userContext')
const { authenticateCredential } = require('../../utils/authorization')

let io = null

// ponytail: log per-koneksi/join di-gate — ribuan koneksi sekaligus tidak
// boleh membanjiri stdout (degradasi performa & log tak terbaca)
const verbose = process.env.NODE_ENV !== 'production'

// HIGH-6: the socket.IO namespace is its own trust boundary — it never saw
// Express's authorization/validateStoreAccess middleware, so the handshake
// must verify the very same credential the REST routes trust. The token is
// accepted from socket.io's `auth` object (modern clients), the query string
// (WebSocket upgrade fallback), or an Authorization header, mirroring
// utils/authorization.js' getToken().
const getSocketToken = (socket) => {
  const auth = socket.handshake?.auth || {}
  if (auth.token) return auth.token
  const query = socket.handshake?.query || {}
  if (query.token) return query.token
  const authHeader = socket.handshake?.headers?.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

// AUTH-1 P4: the handshake enforces the same canonical credential as HTTP
// (utils/authorization.js authenticateCredential): JWT signature/expiry, a
// required sessionId, a live session owned by the JWT's id, and an eligible
// account. socket.user is hydrated from the DB row — JWT role/store/name
// claims are never authority. Denials keep the existing handshake messages
// and never expose internal errors; a lookup failure fails closed.
const authorizeSocket = (socket, next) => {
  const token = getSocketToken(socket)
  if (!token) {
    return next(new Error('Authentication required'))
  }
  authenticateCredential(token).then(
    (result) => {
      if (!result.ok) return next(new Error('Unauthorized'))
      socket.user = result.user
      return next()
    },
    () => next(new Error('Unauthorized'))
  )
}

// Server-internal rooms addressing a socket by the session and the account
// it authenticated with; client join events only ever build `store-`/
// `kitchen-` rooms, so no client can enter these.
const sessionRoom = (sessionId) => `session:${sessionId}`
const userRoom = (userId) => `user:${userId}`

const guardedJoin = (socket, event, room, storeId, ack) => {
  const reject = (message) => {
    if (typeof ack === 'function') ack({ ok: false, message })
    socket.emit('join-rejected', { event, store: storeId, ok: false, message })
  }
  // AUTH-1 P4: every socket is session-backed (the handshake requires it), so
  // every join is validated canonically against the live session and
  // persisted membership/assignment state — never JWT claims.
  canJoinStoreCanonical(socket, storeId).then(
    (allowed) => {
      if (!allowed) return reject('Forbidden store')
      socket.join(room)
      if (verbose) console.log(`Socket ${socket.id} joined ${room}`)
      if (typeof ack === 'function') ack({ ok: true })
    },
    () => reject('Forbidden store')
  )
}

// F5: canonical socket room check. Resolves the same server-side context as
// HTTP (session -> persisted membership/assignment/lifecycle) and allows the
// join only when the requested store is inside the resolved scope. The
// session is re-read on every join, so a session revoked since the handshake
// can never join a room.
const canJoinStoreCanonical = async (socket, storeId) => {
  try {
    const requested = Number(storeId)
    if (!Number.isInteger(requested) || requested <= 0) return false
    const db = require('../../db/models')
    const { loadContextSession } = require('../../utils/authorizationContextMiddleware')
    const { resolveAuthorizationContext } = require('../../utils/authContext')
    const session = await loadContextSession(db, socket.user.sessionId)
    if (!session || Number(session.userId) !== Number(socket.user?.id)) return false
    const ctx = await resolveAuthorizationContext(db, {
      userId: socket.user.id,
      activeTenantId: session.activeTenantId,
      activeStoreId: session.activeStoreId
    })
    if (!ctx || ctx.eligible !== true) return false
    if (ctx.isPlatformAdmin && ctx.activeTenantId == null) return true
    if (ctx.activeTenantId == null) return false
    if (!(ctx.tenantStoreIds || []).map(Number).includes(requested)) return false
    const confined = ['store_admin', 'cashier', 'staff'].includes(ctx.activeRole)
    if (confined && !(ctx.assignedStoreIds || []).map(Number).includes(requested)) return false
    return true
  } catch {
    return false
  }
}

// Re-runs the canonical credential check for the socket's own handshake
// token; anything but the same live, eligible account disconnects it.
const ensureSessionStillLive = (socket) => {
  authenticateCredential(getSocketToken(socket)).then(
    (result) => {
      if (!result.ok || Number(result.user.id) !== Number(socket.user.id)) socket.disconnect(true)
    },
    () => socket.disconnect(true)
  )
}

// AUTH-1 P4 eviction. Called by the revoking code path only AFTER its
// transaction has committed (database revocation stays authoritative; a
// rolled-back revocation never reaches these). In-process only: with the
// single-process in-memory adapter this reaches every socket of the server;
// a multi-instance deployment would need a shared adapter (D5).
const disconnectSession = (sessionId) => {
  if (io && sessionId) io.in(sessionRoom(sessionId)).disconnectSockets(true)
}

const disconnectUser = (userId) => {
  if (io && userId != null) io.in(userRoom(userId)).disconnectSockets(true)
}

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: corsOriginCheck,
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  io.use(authorizeSocket)

  io.on('connection', (socket) => {
    if (verbose) console.log('Client connected:', socket.id)

    // AUTH-1 P4: register the socket under its session and account so a
    // committed revocation can find and disconnect it. A revocation that
    // committed after the handshake but before this registration would miss
    // the socket, so the session is re-checked once registered.
    socket.join([sessionRoom(socket.user.sessionId), userRoom(socket.user.id)])
    ensureSessionStillLive(socket)

    const context = {
      userId: socket.user?.id,
      userName: socket.user?.userName,
      fullName: socket.user?.fullName
    }
    const run = (fn) => (...args) => userContext.run(context, () => fn(...args))

    socket.on(
      'join-kitchen',
      run((storeId, ack) =>
        guardedJoin(socket, 'join-kitchen', `kitchen-${storeId}`, storeId, ack)
      )
    )

    socket.on(
      'leave-kitchen',
      run((storeId) => {
        socket.leave(`kitchen-${storeId}`)
        if (verbose) console.log(`Socket left kitchen-${storeId}`)
      })
    )

    socket.on(
      'join-store',
      run((storeId, ack) =>
        guardedJoin(socket, 'join-store', `store-${storeId}`, storeId, ack)
      )
    )

    socket.on(
      'leave-store',
      run((storeId) => {
        socket.leave(`store-${storeId}`)
        if (verbose) console.log(`Socket left store-${storeId}`)
      })
    )

    socket.on(
      'disconnect',
      run(() => {
        if (verbose) console.log('Client disconnected:', socket.id)
      })
    )
  })

  return io
}

const emitToKitchen = (storeId, event, data) => {
  if (io) {
    io.to(`kitchen-${storeId}`).emit(event, data)
    // P0: a super_admin's "All Stores" KDS view asks for `kitchen-all`
    // instead of any single store's room, so every store's kitchen events are
    // mirrored there. AUTH-1 P4: the canonical join accepts numeric store ids
    // only, so no socket can currently join `kitchen-all` (open decision);
    // that view falls back to polling.
    io.to('kitchen-all').emit(event, data)
  }
}

const emitToStore = (storeId, event, data) => {
  if (io) {
    io.to(`store-${storeId}`).emit(event, data)
  }
}

const emitNewOrder = (storeId, order) => {
  emitToKitchen(storeId, 'new-order', order)
  emitToStore(storeId, 'new-order', order)
}

const emitOrderUpdate = (storeId, order) => {
  emitToKitchen(storeId, 'order-updated', order)
  emitToStore(storeId, 'order-updated', order)
}

const emitItemStatusUpdate = (storeId, orderId, item) => {
  emitToKitchen(storeId, 'item-status-updated', { orderId, item })
}

const emitNotification = (storeId, notification) => {
  if (io) {
    io.to(`store-${storeId}`).emit('new-notification', notification)
    // HIGH-6: was io.emit('new-notification-global') — every connected client
    // in every store received every tenant's notification. Scope it to the
    // store room so only sockets that joined via their own store claim
    // receive it (super_admin panels join every store room deliberately).
    io.to(`store-${storeId}`).emit('new-notification-global', notification)
  }
}

const getIO = () => io

module.exports = {
  initSocket,
  getIO,
  emitToKitchen,
  emitToStore,
  emitNewOrder,
  emitOrderUpdate,
  emitItemStatusUpdate,
  emitNotification,
  canJoinStoreCanonical,
  disconnectSession,
  disconnectUser
}
