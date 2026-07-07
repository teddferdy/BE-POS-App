require('dotenv').config()
require('express-async-errors')
const express = require('express')
const http = require('http')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const compression = require('compression')

const { initSocket } = require('./service/socket')
const { initClient } = require('../utils/whatsappClient')
const userContext = require('../utils/userContext')

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
const posRoutes = require('./routes/pos')
const notificationRoutes = require('./routes/notification')
const currencyRoutes = require('./routes/currency')
const auditLogRoutes = require('./routes/auditLog')
const receiptRoutes = require('./routes/receipt')
const productionOrderRoutes = require('./routes/productionOrder')
const goodsReceiptRoutes = require('./routes/goodsReceipt')
const salesReturnRoutes = require('./routes/salesReturn')
const purchaseReturnRoutes = require('./routes/purchaseReturn')
const bomRoutes = require('./routes/bom')
const reservationRoutes = require('./routes/reservation')
const ingredientCategoryRoutes = require('./routes/ingredientCategory')
const purchasePaymentRoutes = require('./routes/purchasePayment')
const accountsReceivableRoutes = require('./routes/accountsReceivable')
const exportMasterRoutes = require('./routes/exportMaster')
const faq = require('./routes/faq')

const app = express()
const server = http.createServer(app)

const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['https://bisa-nota-demo.vercel.app', 'http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
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
app.use(express.static('public'))

app.use((req, res, next) => {
  userContext.run({ userId: undefined }, () => next())
})

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
  { path: '/pos', route: posRoutes },
  { path: '/notification', route: notificationRoutes },
  { path: '/currency', route: currencyRoutes },
  { path: '/audit-log', route: auditLogRoutes },
  { path: '/receipt', route: receiptRoutes },
  { path: '/production-order', route: productionOrderRoutes },
  { path: '/goods-receipt', route: goodsReceiptRoutes },
  { path: '/sales-return', route: salesReturnRoutes },
  { path: '/purchase-return', route: purchaseReturnRoutes },
  { path: '/bom', route: bomRoutes },
  { path: '/reservation', route: reservationRoutes },
  { path: '/ingredient-category', route: ingredientCategoryRoutes },
  { path: '/purchase-payment', route: purchasePaymentRoutes },
  { path: '/accounts-receivable', route: accountsReceivableRoutes },
  { path: '/export', route: exportMasterRoutes },
  { path: '/faq', route: faq }
]

routes.forEach(({ path, route }) => app.use(path, route))

const { execSync } = require('child_process')
const fs = require('fs')

const ESCPOS_RECEIPT_WIDTH = 48
const escposPadBoth = (left, right, width) => {
  const w = width || ESCPOS_RECEIPT_WIDTH
  const space = Math.max(1, w - left.length - right.length)
  return left + ' '.repeat(space) + right
}
const escposLine = (char, width) => (char || '-').repeat(width || ESCPOS_RECEIPT_WIDTH)
const escposPrice = (val) => `Rp${Number(val || 0).toLocaleString('id-ID')}`
const escposDate = (date) => {
  const d = new Date(date)
  return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
const escposTime = (date) => {
  const d = new Date(date)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function generateESCPOS(data) {
  const w = ESCPOS_RECEIPT_WIDTH
  const {
    storeName = 'TOKO ANDA', storeAddress = '', storePhone = '',
    memberName = '', memberTier = '', memberPoints = 0,
    orderNumber = '', cashier = '', date = new Date().toISOString(),
    items = [], subtotal = 0, discount = 0, serviceCharge = 0, tax = 0,
    total = 0, paymentMethod = 'Tunai', cashAmount = 0, changeAmount = 0,
    footer = 'Terima kasih atas kunjungan Anda'
  } = data

  let enc = ''
  enc += '\x1B\x40'
  enc += '\x1B\x61\x01\x1B\x21\x20\x1B\x45\x01' + storeName + '\n\x1B\x45\x00\x1B\x21\x00'
  enc += '\x1B\x61\x01'
  if (storeAddress) enc += storeAddress + '\n'
  if (storePhone) enc += 'Telp: ' + storePhone + '\n'
  enc += escposLine('=', w) + '\n\x1B\x61\x00'
  enc += escposPadBoth(escposDate(date), escposTime(date)) + '\n'
  enc += escposPadBoth('Invoice: ' + orderNumber, 'Kasir: ' + cashier) + '\n'
  if (memberName) {
    enc += 'Member: ' + memberName + '\n'
    if (memberTier) enc += 'Tier: ' + memberTier + '\n'
    if (memberPoints) enc += 'Poin: ' + Number(memberPoints).toLocaleString('id-ID') + '\n'
  }
  enc += escposLine('=', w) + '\n'
  enc += escposPadBoth('Item', '') + '\n'
  enc += '  ' + 'Qty'.padEnd(3) + '  ' + 'Harga'.padStart(15) + '  ' + 'Total'.padStart(13) + '\n'
  enc += escposLine('-', w) + '\n'
  items.forEach((item) => {
    const name = item.name || item.productName || '-'
    const qty = item.qty || item.quantity || 0
    const price = item.price || 0
    const itemTotal = item.total || item.subtotal || qty * price
    enc += name + '\n'
    enc += '  ' + String(qty).padEnd(3)
    enc += escposPrice(price).padStart(15)
    enc += '  ' + escposPrice(itemTotal).padStart(13) + '\n'
  })
  enc += escposLine('=', w) + '\n'
  enc += escposPadBoth('Subtotal', escposPrice(subtotal)) + '\n'
  if (discount > 0) enc += escposPadBoth('Diskon', '-' + escposPrice(discount)) + '\n'
  if (serviceCharge > 0) enc += escposPadBoth('Biaya Layanan', escposPrice(serviceCharge)) + '\n'
  enc += escposPadBoth('Pajak (10%)', escposPrice(tax)) + '\n'
  enc += '\x1B\x45\x01' + escposLine('=', w) + '\n'
  enc += escposPadBoth('TOTAL', escposPrice(total)) + '\n'
  enc += '\x1B\x45\x00' + escposLine('-', w) + '\n'
  enc += escposPadBoth(paymentMethod, escposPrice(cashAmount)) + '\n'
  if (changeAmount > 0) enc += escposPadBoth('Kembali', escposPrice(changeAmount)) + '\n'
  enc += escposLine('=', w) + '\n\x1B\x61\x01' + footer + '\n\n\n'
  return enc
}

app.post('/print-thermal', (req, res) => {
  const { data, baudRate = 115200 } = req.body
  if (!data) return res.status(400).json({ success: false, message: 'No receipt data' })

  const port = '/dev/cu.RPP02N'
  if (!fs.existsSync(port)) {
    return res.status(404).json({ success: false, message: 'RPP02N not paired. Open Bluetooth Settings, pair the printer, then retry.' })
  }

  try {
    const escpos = generateESCPOS(data)
    execSync(`stty -f "${port}" ${baudRate} cs8 -cstopb -parenb 2>/dev/null`)

    const timeout = setTimeout(() => {
      res.status(504).json({ success: false, message: 'Printer not responding. Check: (1) Printer is ON (2) Connected in Bluetooth settings' })
    }, 5000)

    fs.writeFile(port, Buffer.from(escpos, 'ascii'), () => {
      clearTimeout(timeout)
      res.json({ success: true, message: 'Printed via RPP02N' })
    })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

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

if (!process.env.VERCEL) {
  initSocket(server)
  initClient()
  server.listen(port, () => {
    console.log(`Server running on port ${port}`)
    console.log(`Socket.IO enabled`)
  })
}

module.exports = app
