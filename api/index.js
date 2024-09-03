/* eslint-disable no-undef */
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')

// Routes
const productRoutes = require('./routes/product')
const authRoutes = require('./routes/auth')
const categoryRoutes = require('./routes/category')
const locationRoutes = require('./routes/location')
const memberRoutes = require('./routes/member')

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

app.use(express.static(__dirname, '/assets'))
app.use('/product', productRoutes)
app.use('/auth', authRoutes)
app.use('/category', categoryRoutes)
app.use('/location', locationRoutes)
app.use('/member', memberRoutes)

const server = app.listen(process.env.POSTGRES_PORT || 5000, () => {
  console.log('server running port 5000')
})
server.timeout = 120000
