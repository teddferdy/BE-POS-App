require('dotenv').config({ path: __dirname + '/../.env' })
const sequelize = require('../config/database')

async function sync() {
  console.log('Starting database sync...\n')

  try {
    console.log('Testing database connection...')
    await sequelize.authenticate()
    console.log('Database connected!\n')

    console.log('Syncing all models...')
    await sequelize.sync({ alter: true })

    console.log('\nSync completed successfully!')

  } catch (error) {
    console.error('Sync failed:', error)
    process.exit(1)
  } finally {
    await sequelize.close()
    console.log('Database connection closed.')
  }
}

sync()