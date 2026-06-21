//!/usr/bin/env node
require('dotenv').config({ path: __dirname + '/.env' })
const db = require('./db/models/index')

async function testQueries() {
  try {
    console.log('🔌 Connecting to database...')
    await db.sequelize.authenticate()
    console.log('✅ Connected!\n')
    
    console.log('Querying for super_admin user...')
    const userResult = await db.sequelize.query(
      `SELECT id FROM "user" WHERE "userName" = 'super_admin' LIMIT 1`
    )
    console.log('User result:', userResult[0])
    
    console.log('Querying for super_admin role...')
    const roleResult = await db.sequelize.query(
      `SELECT id FROM role WHERE "roleType" = 'super_admin' LIMIT 1`
    )
    console.log('Role result:', roleResult[0])
    
    await db.sequelize.close()
    
  } catch (error) {
    console.error('❌ Query test failed:', error.message)
    process.exit(1)
  }
}

testQueries()
