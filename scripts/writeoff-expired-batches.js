require('dotenv').config()
const db = require('../db/models')
const { writeOffExpired } = require('../api/service/batchService')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function main() {
  const storeId = arg('store', null)
  const productId = arg('product', null)
  const result = await writeOffExpired({ storeId, productId })
  console.log(`Write-off batch expired selesai. Total qty: ${result.total}, batch: ${result.affected.length}`)
  for (const a of result.affected) {
    console.log(`  batch#${a.batchId} ${a.batchCode} product=${a.product} store=${a.store} qty=${a.qty}`)
  }
  await db.sequelize.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
