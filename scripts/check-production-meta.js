require('dotenv').config({ path: `${process.cwd()}/.env.production` })
const { Sequelize } = require('sequelize')
const pg = require('pg')

const sequelize = new Sequelize({
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  host: process.env.POSTGRES_HOST,
  port: 5432,
  dialect: 'postgres',
  dialectModule: pg,
  protocol: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  logging: false
})

async function check() {
  const [meta] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name')
  console.log('=== SequelizeMeta entries ===')
  meta.forEach((r) => console.log(r.name))

  const tables = [
    'product_store', 'category_store', 'supplier_product', 'supplier_product_pivot'
  ]
  for (const t of tables) {
    const [r] = await sequelize.query(
      `SELECT to_regclass('public.${t}') IS NOT NULL AS exists`
    )
    console.log(`\nTable "${t}": ${r[0].exists ? 'EXISTS' : 'MISSING'}`)
  }

  const [cols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'order' AND table_schema = 'public'`
  )
  const colNames = cols.map((c) => c.column_name)
  console.log('\nOrder columns:')
  console.log('  promoCampaignId:', colNames.includes('promocampaignid') || colNames.includes('promoCampaignId') ? 'EXISTS' : 'MISSING')
  console.log('  supplier:', colNames.includes('supplier') ? 'EXISTS' : 'MISSING')

  await sequelize.close()
}

check().catch(console.error)
