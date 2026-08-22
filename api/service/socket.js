const { Server } = require('socket.io')
// ponytail: pakai kebijakan origin yang sama dengan Express REST
const { corsOriginCheck } = require('../utils/corsOptions')

let io = null

// ponytail: log per-koneksi/join di-gate — ribuan koneksi sekaligus tidak
// boleh membanjiri stdout (degradasi performa & log tak terbaca)
const verbose = process.env.NODE_ENV !== 'production'

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: corsOriginCheck,
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    if (verbose) console.log('Client connected:', socket.id)

    socket.on('join-kitchen', (storeId) => {
      socket.join(`kitchen-${storeId}`)
      if (verbose) console.log(`Socket joined kitchen-${storeId}`)
    })

    socket.on('leave-kitchen', (storeId) => {
      socket.leave(`kitchen-${storeId}`)
      if (verbose) console.log(`Socket left kitchen-${storeId}`)
    })

    socket.on('join-store', (storeId) => {
      socket.join(`store-${storeId}`)
      if (verbose) console.log(`Socket joined store-${storeId}`)
    })

    socket.on('leave-store', (storeId) => {
      socket.leave(`store-${storeId}`)
      if (verbose) console.log(`Socket left store-${storeId}`)
    })

    socket.on('disconnect', () => {
      if (verbose) console.log('Client disconnected:', socket.id)
    })
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
    io.emit('new-notification-global', notification)
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
