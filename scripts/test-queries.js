const { Sequelize } = require('sequelize')
require('dotenv').config({ path: process.argv[2] || '.env' })

async function main() {
  const sequelize = new Sequelize(
    process.env.POSTGRES_DATABASE,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT || 5432,
      dialect: 'postgres',
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
      },
      logging: false
    }
  )

  try {
    await sequelize.authenticate()
    console.log('=== TEST QUERIES (mirroring production endpoints) ===\n')

    // 1. Simulate getAllLocationPublic
    try {
      const [rows] = await sequelize.query(
        `SELECT id, name, city, province, "detailLocation" FROM location
         WHERE "deletedAt" IS NULL AND status = 'active' LIMIT 5`
      )
      console.log(`✓ getAllLocationPublic: ${rows.length} rows`)
      if (rows[0]) console.log('  Sample:', rows[0])
    } catch (e) {
      console.log(`✗ getAllLocationPublic FAILED: ${e.message}`)
    }

    // 2. Simulate department dropdown
    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM department WHERE status = 'active' LIMIT 3`
      )
      console.log(`✓ department active: ${rows.length} rows`)
    } catch (e) {
      console.log(`✗ department FAILED: ${e.message}`)
    }

    // 3. Simulate position dropdown
    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM position WHERE status = 'active' LIMIT 3`
      )
      console.log(`✓ position active: ${rows.length} rows`)
    } catch (e) {
      console.log(`✗ position FAILED: ${e.message}`)
    }

    // 4. Simulate product list
    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM product WHERE status = 'active' LIMIT 3`
      )
      console.log(`✓ product active: ${rows.length} rows`)
    } catch (e) {
      console.log(`✗ product FAILED: ${e.message}`)
    }

    // 5. Show sample status values from each table
    console.log('\n=== SAMPLE STATUS VALUES ===')
    const tables = ['category', 'department', 'discount', 'ingredient', 'location', 'product', 'role', 'shift', 'supplier']
    for (const t of tables) {
      try {
        const [rows] = await sequelize.query(
          `SELECT status, COUNT(*) as count FROM "${t}" GROUP BY status`
        )
        console.log(`  ${t}:`, rows.map(r => `${r.status}(${r.count})`).join(', '))
      } catch (e) {
        console.log(`  ${t}: ${e.message}`)
      }
    }
  } catch (err) {
    console.error('Connection error:', err.message)
  } finally {
    await sequelize.close()
  }
}

main()
