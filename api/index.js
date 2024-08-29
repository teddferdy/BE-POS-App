/* eslint-disable no-undef */
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')

// Routes
// const homeRoutes = require("./routes/home");
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

// const whitelist = ['*']

app.use(cors(corsOptions))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cookieParser())

// app.use((req, res, next) => {
//   console.log('TOKEN COK', app.get('token'))

// const origin = req.get('referer')
// const isWhitelisted = whitelist.find((w) => origin && origin.includes(w))
// if (isWhitelisted) {
//   res.setHeader('Access-Control-Allow-Origin', '*')
//   res.setHeader('Content-Type', 'application/json')
//   res.cookie('token', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
// }
// // Pass to next layer of middleware
// if (req.method === 'OPTIONS') res.sendStatus(200)
// else next()
// })

// const setContext = (req, res, next) => {
//   if (!req.context) req.context = {}
//   next()
// }
// app.use(setContext)
app.use('/auth', authRoutes)
app.use('/category', categoryRoutes)
app.use('/location', locationRoutes)
app.use('/member', memberRoutes)

// app.use("/product", homeRoutes);

const server = app.listen(process.env.POSTGRES_PORT || 5000, () => {
  console.log('server running port 5000')
})
server.timeout = 120000
