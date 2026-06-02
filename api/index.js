require('dotenv').config()
const express = require('express')
const http = require('http')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const compression = require('compression')

const { initSocket } = require('./service/socket')

const productRoutes = require('./routes/product')
const authRoutes = require('./routes/auth')
const categoryRoutes = require('./routes/category')
const locationRoutes = require('./routes/location')
const memberRoutes = require('./routes/member')
const checkoutRoutes = require('./routes/checkout')
const discountRoutes = require('./routes/discount')
const shiftRoutes = require('./routes/shift')
const typePaymentRoutes = require('./routes/type-payment')
const bestSellingRoutes = require('./routes/best-selling')
const overviewRoutes = require('./routes/overview')
const socialMediaRoutes = require('./routes/social-media')
const invoiceRoutes = require('./routes/invoice')
const roleRoutes = require('./routes/role')
const positionRoutes = require('./routes/position')
const tableRoutes = require('./routes/table')
const orderRoutes = require('./routes/order')
const supplierRoutes = require('./routes/supplier')
const purchaseOrderRoutes = require('./routes/purchaseOrder')
const ingredientRoutes = require('./routes/ingredient')
const stockHistoryRoutes = require('./routes/stockHistory')
const stockOpnameRoutes = require('./routes/stockOpname')
const expenseCategoryRoutes = require('./routes/expenseCategory')
const expenseRoutes = require('./routes/expense')
const cashRegisterRoutes = require('./routes/cashRegister')
const reportRoutes = require('./routes/report')
const splitBillRoutes = require('./routes/splitBill')
const memberTierRoutes = require('./routes/memberTier')
const employeeRoutes = require('./routes/employee')
const departmentRoutes = require('./routes/department')
const taxConfigRoutes = require('./routes/taxConfig')
const priceListTemplateRoutes = require('./routes/priceListTemplate')
const posRoutes = require('./routes/pos')
const notificationRoutes = require('./routes/notification')
const currencyRoutes = require('./routes/currency')
const auditLogRoutes = require('./routes/auditLog')
const receiptRoutes = require('./routes/receipt')

const app = express()
const server = http.createServer(app)

const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['https://bisa-nota-demo.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
})

app.set('trust proxy', 1)
app.use(helmet())
app.use(compression())
app.use(cors(corsOptions))
app.use(limiter)
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cookieParser())

const routes = [
  { path: '/auth', route: authRoutes },
  { path: '/product', route: productRoutes },
  { path: '/category', route: categoryRoutes },
  { path: '/location', route: locationRoutes },
  { path: '/member', route: memberRoutes },
  { path: '/order', route: orderRoutes },
  { path: '/table', route: tableRoutes },
  { path: '/checkout', route: checkoutRoutes },
  { path: '/discount', route: discountRoutes },
  { path: '/shift', route: shiftRoutes },
  { path: '/type-payment', route: typePaymentRoutes },
  { path: '/best-selling', route: bestSellingRoutes },
  { path: '/overview', route: overviewRoutes },
  { path: '/social-media', route: socialMediaRoutes },
  { path: '/invoice', route: invoiceRoutes },
  { path: '/role', route: roleRoutes },
  { path: '/position', route: positionRoutes },
  { path: '/supplier', route: supplierRoutes },
  { path: '/purchase-order', route: purchaseOrderRoutes },
  { path: '/ingredient', route: ingredientRoutes },
  { path: '/stock-history', route: stockHistoryRoutes },
  { path: '/stock-opname', route: stockOpnameRoutes },
  { path: '/expense-category', route: expenseCategoryRoutes },
  { path: '/expense', route: expenseRoutes },
  { path: '/cash-register', route: cashRegisterRoutes },
  { path: '/report', route: reportRoutes },
  { path: '/split-bill', route: splitBillRoutes },
  { path: '/member-tier', route: memberTierRoutes },
  { path: '/employee', route: employeeRoutes },
    { path: '/department', route: departmentRoutes },
    { path: '/tax-config', route: taxConfigRoutes },
    { path: '/price-list-template', route: priceListTemplateRoutes },
    { path: '/pos', route: posRoutes },
    { path: '/notification', route: notificationRoutes },
    { path: '/currency', route: currencyRoutes },
    { path: '/audit-log', route: auditLogRoutes },
    { path: '/receipt', route: receiptRoutes }
  ]

routes.forEach(({ path, route }) => app.use(path, route))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  })
})

app.get('/', (_, res) => {
  res.status(200).json({
    success: true,
    message: 'POS API is running',
    socket: '/socket.io'
  })
})

const port = process.env.PORT || 5001

initSocket(server)

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
  console.log(`Socket.IO enabled`)
})
