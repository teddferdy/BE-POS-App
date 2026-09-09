const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
// ponytail: pakai kebijakan origin yang sama dengan Express REST
const { corsOriginCheck } = require('../utils/corsOptions')
const userContext = require('../../utils/userContext')

let io = null

// ponytail: log per-koneksi/join di-gate — ribuan koneksi sekaligus tidak
// boleh membanjiri stdout (degradasi performa & log tak terbaca)
const verbose = process.env.NODE_ENV !== 'production'

// HIGH-6: the socket.IO namespace is its own trust boundary — it never saw
// Express's authorization/validateStoreAccess middleware, so the handshake
// must verify the very same JWT the REST routes trust (JWT_SECRET_KEY) and
// bind room membership to the verified `store` claim. The token is accepted
// from socket.io's `auth` object (modern clients), the query string
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

const authorizeSocket = (socket, next) => {
  const token = getSocketToken(socket)
  if (!token) {
    return next(new Error('Authentication required'))
  }
  try {
    // HIGH-6: only the JWT's own claims are trusted — roleType and store
    // cannot be spoofed from the client payload because the token is signed.
    socket.user = jwt.verify(token, process.env.JWT_SECRET_KEY)
    return next()
  } catch {
    return next(new Error('Unauthorized'))
  }
}

const isSuperAdminSocket = (socket) => socket.user?.roleType === 'super_admin'

// HIGH-6: a non-super socket may only ever join the room that corresponds to
// its verified `store` claim. The client-supplied storeId is compared, never
// interpolated first, so payload coercion (arrays, objects, NaN, string
// floats) cannot forge another tenant's room.
const canJoinStore = (socket, storeId) => {
  if (isSuperAdminSocket(socket)) return true
  const userStore = Number(socket.user?.store)
  const requested = Number(storeId)
  return (
    Number.isFinite(userStore) &&
    Number.isFinite(requested) &&
    userStore === requested
  )
}

const guardedJoin = (socket, event, room, storeId, ack) => {
  const reject = (message) => {
    if (typeof ack === 'function') ack({ ok: false, message })
    socket.emit('join-rejected', { event, store: storeId, ok: false, message })
  }
  if (!canJoinStore(socket, storeId)) {
    return reject('Forbidden store')
  }
  socket.join(room)
  if (verbose) console.log(`Socket ${socket.id} joined ${room}`)
  if (typeof ack === 'function') ack({ ok: true })
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
  emitNotification
}
