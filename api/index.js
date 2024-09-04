/* eslint-disable no-undef */
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')
// const whatsappClient = require('./service/whatsappClient')

// Routes
const productRoutes = require('./routes/product')
const authRoutes = require('./routes/auth')
const categoryRoutes = require('./routes/category')
const locationRoutes = require('./routes/location')
const memberRoutes = require('./routes/member')
// const messageRoutes = require('./routes/message')
const checkoutRoutes = require('./routes/checkout')

const corsOptions = {
  credentials: true,
  optionsSuccessStatus: 200
}

// Error Controller
const app = express()

app.use(cors(corsOptions))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cookieParser())
// whatsappClient.initialize()

// app.use('/message', messageRoutes)
app.use('/product', productRoutes)
app.use('/auth', authRoutes)
app.use('/category', categoryRoutes)
app.use('/location', locationRoutes)
app.use('/member', memberRoutes)
app.use('/checkout', checkoutRoutes)

const server = app.listen(process.env.POSTGRES_PORT || 5000, () => {
  console.log('server running port 5000')
})
server.timeout = 120000
