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
const subCategoryRoutes = require('./routes/sub-category')
const discountRoutes = require('./routes/discount')
const employeeRoutes = require('./routes/employee')
const shiftRoutes = require('./routes/shift')
const typePaymentRoutes = require('./routes/type-payment')
const bestSellingRoutes = require('./routes/best-selling')
const overviewRoutes = require('./routes/overview')
const otherRoutes = require('./routes/other')
const socialMediaRoutes = require('./routes/social-media')
const invoiceRoutes = require('./routes/invoice')
const roleRoutes = require('./routes/role')

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
app.use('/sub-category', subCategoryRoutes)
app.use('/discount', discountRoutes)
app.use('/employee', employeeRoutes)
app.use('/shift', shiftRoutes)
app.use('/type-payment', typePaymentRoutes)
app.use('/best-selling', bestSellingRoutes)
app.use('/overview', overviewRoutes)
app.use('/other', otherRoutes)
app.use('/social-media', socialMediaRoutes)
app.use('/invoice', invoiceRoutes)
app.use('/role', roleRoutes)

// Generate Invoice
// app.use('/generate')

const server = app.listen(process.env.POSTGRES_PORT || 5000, () => {
  console.log('server running port 5000')
})
server.timeout = 120000
