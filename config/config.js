/* eslint-disable no-undef */
const pg = require('pg')
require('dotenv').config({ path: `${process.cwd()}/.env` })

module.exports = {
  development: {
    username: process.env.DB_DEV_USERNAME || 'postgres',
    password: process.env.DB_DEV_PASSWORD || 'teddyferdian98',
    database: process.env.DB_DEV_DATABASE || 'cashier_app',
    host: process.env.DB_DEV_HOST || '127.0.0.1', // ✅ gunakan 127.0.0.1
    port: process.env.DB_DEV_PORT || 5432, // ✅ jangan pakai string
    dialect: 'postgres',
    timezone: '+07:00'
  },
  test: {
    username: process.env.DB_DEV_USERNAME,
    password: process.env.DB_DEV_PASSWORD,
    database: process.env.DB_DEV_DATABASE,
    host: process.env.DB_DEV_HOST,
    port: process.env.DB_DEV_PORT,
    dialect: 'postgres',
    timezone: '+07:00'
  },
  production: {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    host: process.env.POSTGRES_HOST,
    port: 5432,
    dialect: 'postgres',
    dialectModule: pg,
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    timezone: '+07:00'
  }
}
