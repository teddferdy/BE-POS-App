/* eslint-disable no-undef */
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')

const productRoutes = require('./routes/product')
const authRoutes = require('./routes/auth')
const categoryRoutes = require('./routes/category')
const locationRoutes = require('./routes/location')
const memberRoutes = require('./routes/member')
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
const positionRoutes = require('./routes/position')

const app = express()
const corsOptions = {
  credentials: true,
  optionsSuccessStatus: 200
}

// Middleware
app.use(cors(corsOptions))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cookieParser())

// Route setup
const routes = [
  { path: '/product', route: productRoutes },
  { path: '/auth', route: authRoutes },
  { path: '/category', route: categoryRoutes },
  { path: '/location', route: locationRoutes },
  { path: '/member', route: memberRoutes },
  { path: '/checkout', route: checkoutRoutes },
  { path: '/sub-category', route: subCategoryRoutes },
  { path: '/discount', route: discountRoutes },
  { path: '/employee', route: employeeRoutes },
  { path: '/shift', route: shiftRoutes },
  { path: '/type-payment', route: typePaymentRoutes },
  { path: '/best-selling', route: bestSellingRoutes },
  { path: '/overview', route: overviewRoutes },
  { path: '/other', route: otherRoutes },
  { path: '/social-media', route: socialMediaRoutes },
  { path: '/invoice', route: invoiceRoutes },
  { path: '/role', route: roleRoutes },
  { path: '/position', route: positionRoutes }
]

routes.forEach(({ path, route }) => app.use(path, route))

// Error handling middleware
app.use((err, req, res) => {
  console.error(err.stack)
  res.status(500).send({ error: 'Something went wrong!' })
})

// Start server
const port = process.env.POSTGRES_PORT || 5000
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
server.timeout = 120000 // Adjust if needed
