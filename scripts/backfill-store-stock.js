const { sequelize } = require('../db/models')

async function backfill() {
  console.log('Backfilling product_store_stock...')
  const [products] = await sequelize.query(
    `SELECT id, store, stock FROM "product" WHERE store IS NOT NULL AND store != '[]'::jsonb AND "deletedAt" IS NULL`
  )
  let count = 0

  for (const p of products) {
    let stores = p.store
    if (typeof stores === 'string') {
      try {
        stores = JSON.parse(stores)
      } catch {
        stores = null
      }
    }
    if (!Array.isArray(stores) || stores.length === 0) continue

    const perStore = Math.floor((Number(p.stock) || 0) / stores.length)
    const remainder = (Number(p.stock) || 0) - perStore * stores.length

    for (let i = 0; i < stores.length; i++) {
      const stock = i === 0 ? perStore + remainder : perStore
      await sequelize.query(
        `INSERT INTO "product_store_stock" ("product","store","stock","createdAt","updatedAt")
         VALUES (:product, :store, :stock, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        { replacements: { product: p.id, store: stores[i], stock } }
      )
      count++
    }
  }

  console.log(`Created ${count} product_store_stock rows`)
  process.exit(0)
}

backfill().catch((err) => {
  console.error(err)
  process.exit(1)
})
