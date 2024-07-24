const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // user: process.env.POSTGRES_USER_LOCAL,
  // host: process.env.POSTGRES_HOST_LOCAL,
  // password: process.env.POSTGRES_PASSWORD_LOCAL,
  // database: process.env.POSTGRES_DATABASE_LOCAL,
  // port: process.env.POSTGRES_PORTING_LOCAL,
  // idleTimeoutMillis: 0,
  // connectionTimeoutMillis: 0,
});

module.exports = {
  pool,
};
