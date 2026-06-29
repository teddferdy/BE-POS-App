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
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      logging: false
    }
  )

  await sequelize.authenticate()
  console.log('=== RAW STATUS VALUES PER TABLE ===\n')

  const tables = [
    'category',
    'department',
    'discount',
    'ingredient',
    'invoice_setting',
    'location',
    'member',
    'currency',
    'position',
    'product',
    'role',
    'shift',
    'social_media',
    'supplier',
    'type_payment'
  ]

  for (const t of tables) {
    try {
      const [rows] = await sequelize.query(
        `SELECT id, name, status FROM "${t}" ORDER BY id LIMIT 5`
      )
      console.log(`\n[${t}] ${rows.length} sample rows:`)
      rows.forEach((r) => {
        console.log(
          `  id=${r.id} name="${(r.name || '').slice(0, 30)}" status="${r.status}" (${typeof r.status})`
        )
      })
      const [counts] = await sequelize.query(
        `SELECT status, COUNT(*) as c FROM "${t}" GROUP BY status`
      )
      console.log(
        `  Total distribution:`,
        counts.map((c) => `"${c.status}"=${c.c}`).join(', ')
      )
    } catch (e) {
      console.log(`[${t}] ERROR: ${e.message}`)
    }
  }

  await sequelize.close()
}

main()
