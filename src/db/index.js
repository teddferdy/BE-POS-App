const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL_URL,
  user: process.env.POSTGRES_USER,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORTING,
  host: process.env.POSTGRES_HOST,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 0,
});

module.exports = {
  pool,
};
