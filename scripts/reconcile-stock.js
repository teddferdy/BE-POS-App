require('dotenv').config()
const db = require('../db/models')
const { getDiscrepancies, reconcile } = require('../api/service/reconcileService')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (name) => process.argv.indexOf(`--${name}`) > -1

async function main() {
  const mode = has('fix')
    ? arg('direction', 'store-to-global')
    : 'report'
  const storeId = arg('store', null)
  const productId = arg('product', null)
  const minDiff = Number(arg('min-diff', 1))

  if (mode === 'report') {
    const rows = await getDiscrepancies({ storeId, productId, minDiff })
    console.log(`Rekon (report) | store=${storeId || 'all'} | produk=${productId || 'all'}`)
    console.log(`Produk dengan selisih >= ${minDiff}: ${rows.length}`)
    for (const r of rows) {
      console.log(
        `  #${r.productId} ${r.nameProduct}: global=${r.globalStock}, per-store=${r.perStoreTotal}, selisih=${r.diff}`
      )
    }
    await db.sequelize.close()
    process.exit(0)
  }

  const result = await reconcile({
    direction: mode,
    storeId,
    productId,
    createdBy: null
  })
  console.log(`Rekon (fix, ${result.direction}) selesai. Perubahan: ${result.total}`)
  for (const c of result.changes) {
    console.log(`  product#${c.productId}${c.store ? ` store=${c.store}` : ''} ${c.field}: ${c.before} -> ${c.after}`)
  }
  await db.sequelize.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
