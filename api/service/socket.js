const { Server } = require('socket.io')

let io = null

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('join-kitchen', (storeId) => {
      socket.join(`kitchen-${storeId}`)
      console.log(`Socket joined kitchen-${storeId}`)
    })

    socket.on('leave-kitchen', (storeId) => {
      socket.leave(`kitchen-${storeId}`)
      console.log(`Socket left kitchen-${storeId}`)
    })

    socket.on('join-store', (storeId) => {
      socket.join(`store-${storeId}`)
      console.log(`Socket joined store-${storeId}`)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
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

module.exports = {
  initSocket,
  emitToKitchen,
  emitToStore,
  emitNewOrder,
  emitOrderUpdate,
  emitItemStatusUpdate,
  emitNotification
}
