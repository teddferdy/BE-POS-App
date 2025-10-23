/* eslint-disable no-undef */
const { Sequelize } = require('sequelize')

const env = process.env.NODE_ENV || 'development'

const config = require('./config')

console.log('Current ENV:', env)
console.log('DB CONFIG:', config[env])

const sequelize = new Sequelize(config[env])

sequelize
  .authenticate()
  .then(() => console.log('✅ Database connected successfully!'))
  .catch((err) => console.error('❌ Database connection error:', err))

module.exports = sequelize
