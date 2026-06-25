const { Sequelize } = require('sequelize')
require('dotenv').config({ path: process.argv[2] || '.env' })

const TABLES = [
  'category',
  'department',
  'discount',
  'expenseCategory',
  'ingredient',
  'invoice_setting',
  'location',
  'member',
  'memberTier',
  'currency',
  'position',
  'product',
  'role',
  'shift',
  'social_media',
  'supplier',
  'taxConfig',
  'type_payment'
]

async function main() {
  const sequelize = new Sequelize(
    process.env.POSTGRES_DATABASE,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT || 5432,
      dialect: 'postgres',
      dialectOptions:
        process.env.POSTGRES_HOST?.includes('vercel') ||
        process.env.POSTGRES_HOST?.includes('neon') ||
        process.env.POSTGRES_HOST?.includes('aws')
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {},
      logging: false
    }
  )

  try {
    await sequelize.authenticate()
    console.log('✓ Connected to:', process.env.POSTGRES_HOST)
    console.log('---')
    let needsMigration = 0
    for (const table of TABLES) {
      const [cols] = await sequelize.query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = '${table}' AND column_name = 'status'`,
        { type: Sequelize.QueryTypes.SELECT }
      )
      if (!cols) {
        console.log(`  ${table.padEnd(20)} - kolom 'status' tidak ada`)
        continue
      }
      const dataType = cols.data_type
      const isBroken = dataType === 'boolean'
      const icon = isBroken ? '✗ BOOLEAN' : '✓ VARCHAR'
      console.log(`  ${table.padEnd(20)} - ${icon}  (${dataType})`)
      if (isBroken) needsMigration++
    }
    console.log('---')
    console.log(
      `Tabel yang masih BOOLEAN: ${needsMigration} / ${TABLES.length}`
    )
    if (needsMigration > 0) {
      console.log('⚠️  Migration WAJIB dijalankan sebelum deploy!')
    } else {
      console.log('✓ Schema sudah benar, aman deploy.')
    }
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await sequelize.close()
  }
}

main()
