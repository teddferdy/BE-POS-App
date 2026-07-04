#!/usr/bin/env node
require('dotenv').config({ path: __dirname + '/.env' })
const BASE = 'http://127.0.0.1:5001'

let TOKEN = ''

async function api(method, path, body, formData = false) {
  const url = BASE + path
  const opts = {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, Cookie: 'store=1' }
  }
  if (body && !formData) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  } else if (body && formData) {
    opts.body = body
  }
  const res = await fetch(url, opts)
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}

async function getOrCreate(path, checkField, createBody, nameField = 'name') {
  const list = await api('GET', path, undefined)
  const items = list.data || list
  if (Array.isArray(items) && items.length > 0) {
    const existing = items.find(i => i[nameField] === createBody[nameField])
    if (existing) { console.log(`  Using existing ${createBody[nameField]} (ID: ${existing.id})`); return existing.id }
  }
  const res = await api('POST', path, createBody)
  if (!res.success) { console.error(`  Create ${createBody[nameField]} failed:`, res); return null }
  console.log(`  Created ${res.data[nameField]} (ID: ${res.data.id})`)
  return res.data.id
}

async function main() {
  const login = await api('POST', '/auth/login', { userName: 'superadmin@posapp.com', password: 'superadmin123' })
  TOKEN = login.token
  if (!TOKEN) { console.error('Login failed:', login); return }
  console.log('✅ Login OK')

  // Get existing ingredient (check) & supplier list
  const existingIngs = await api('GET', '/ingredient/get-all?limit=100', undefined)

  const CAT_ID = await getOrCreate('/ingredient-category/get-all', 'name', { name: 'Bahan Kopi', status: 'active' })
  if (!CAT_ID) return

  const SUPP_ID = await getOrCreate('/supplier/', 'name', { name: 'PT Kopi Nusantara', phone: '02112345678', email: 'info@kopinusantara.com', address: 'Jakarta', status: 'active' })
  if (!SUPP_ID) return

  const ingredientDefs = [
    { name: 'Kopi Bubuk', category: CAT_ID, supplier: SUPP_ID, stock: 5000, unit: 'gram', costPrice: 500, minStock: 500 },
    { name: 'Susu Cair', category: CAT_ID, supplier: SUPP_ID, stock: 10000, unit: 'ml', costPrice: 200, minStock: 1000 },
    { name: 'Coklat Bubuk', category: CAT_ID, supplier: SUPP_ID, stock: 2000, unit: 'gram', costPrice: 300, minStock: 200 },
    { name: 'Sirup Coklat', category: CAT_ID, supplier: SUPP_ID, stock: 1000, unit: 'ml', costPrice: 250, minStock: 100 },
    { name: 'Air Mineral', category: CAT_ID, supplier: SUPP_ID, stock: 50000, unit: 'ml', costPrice: 50, minStock: 5000 },
    { name: 'Es Batu', category: CAT_ID, supplier: SUPP_ID, stock: 500, unit: 'butir', costPrice: 100, minStock: 50 },
  ]
  const ING_IDS = {}
  const ingList = existingIngs?.data || []
  for (const def of ingredientDefs) {
    const existing = ingList.find(i => i.name === def.name)
    if (existing) { ING_IDS[def.name] = existing.id; console.log(`  Using existing ${def.name} (ID: ${existing.id})`); continue }
    const res = await api('POST', '/ingredient/add', def)
    if (!res.success) { console.error(`Ingredient ${def.name} failed:`, res); return }
    ING_IDS[def.name] = res.data.id
    console.log(`  Created ${def.name} (ID: ${res.data.id})`)
  }

  // Create PO only if not exists
  const existingPOs = await api('GET', '/purchase-order/get-all?limit=10', undefined)
  const poList = existingPOs?.data || []
  let PO_ID = poList.find(p => p.status === 'received')?.id
  if (!PO_ID) {
    PO_ID = poList.find(p => p.status !== 'cancelled')?.id
  }
  if (!PO_ID) {
    const po = await api('POST', '/purchase-order/create', {
      supplier: SUPP_ID, orderDate: '2026-07-04', dueDate: '2026-08-04', notes: 'PO awal bahan kopi',
      items: [
        { ingredient: ING_IDS['Kopi Bubuk'], ingredientName: 'Kopi Bubuk', quantity: 10000, unit: 'gram', price: 500 },
        { ingredient: ING_IDS['Susu Cair'], ingredientName: 'Susu Cair', quantity: 20000, unit: 'ml', price: 200 },
        { ingredient: ING_IDS['Coklat Bubuk'], ingredientName: 'Coklat Bubuk', quantity: 5000, unit: 'gram', price: 300 },
      ]
    })
    if (!po.success) { console.error('PO failed:', po); return }
    PO_ID = po.data.id
    console.log(`✅ PO Created (ID: ${PO_ID})`)
  } else {
    console.log(`  Using existing PO (ID: ${PO_ID})`)
  }

  // Receive PO
  const recv = await api('PUT', `/purchase-order/receive/${PO_ID}`, {})
  if (!recv.success) { console.log(`  PO receive note: ${recv.message || 'already received or other issue'}`) }
  else { console.log(`✅ PO Received (ID: ${PO_ID})`) }

  // Product Category
  const existingPCats = await api('GET', '/category/get-category-all?limit=10', undefined)
  const pcatList = existingPCats?.data || []
  let PCAT_ID = pcatList.find(c => c.name === 'Kopi')?.id
  if (!PCAT_ID) {
    const form = new FormData()
    form.append('name', 'Kopi'); form.append('description', 'Kategori minuman kopi'); form.append('status', 'active')
    const pcat = await api('POST', '/category/add-new-category', form, true)
    if (!pcat.success) { console.error('Product category failed:', pcat); return }
    PCAT_ID = pcat.data.id
    console.log(`✅ Product Category created (ID: ${PCAT_ID})`)
  } else {
    console.log(`  Using existing product category Kopi (ID: ${PCAT_ID})`)
  }

  // Products
  const productDefs = [
    { nameProduct: 'Espresso', category: PCAT_ID, price: 15000, costPrice: 2500, unit: 'porsi', tipeProduk: 'menu', stock: 100 },
    { nameProduct: 'Cappuccino', category: PCAT_ID, price: 25000, costPrice: 4500, unit: 'porsi', tipeProduk: 'menu', stock: 100 },
    { nameProduct: 'Latte', category: PCAT_ID, price: 30000, costPrice: 4500, unit: 'porsi', tipeProduk: 'menu', stock: 100 },
    { nameProduct: 'Mocha', category: PCAT_ID, price: 35000, costPrice: 5500, unit: 'porsi', tipeProduk: 'menu', stock: 100 },
    { nameProduct: 'Cold Brew', category: PCAT_ID, price: 25000, costPrice: 3000, unit: 'porsi', tipeProduk: 'menu', stock: 100 },
  ]
  const PROD_IDS = {}
  const existingProds = await api('GET', '/product/get-product-all?limit=100', undefined)
  const prodList = existingProds?.data || []
  for (const def of productDefs) {
    const existing = prodList.find(p => p.nameProduct === def.nameProduct)
    if (existing) { PROD_IDS[def.nameProduct] = existing.id; console.log(`  Using existing ${def.nameProduct} (ID: ${existing.id})`); continue }
    const f = new FormData()
    for (const [k, v] of Object.entries(def)) f.append(k, String(v))
    const res = await api('POST', '/product/add-product', f, true)
    if (!res.success) { console.error(`Product ${def.nameProduct} failed:`, res); return }
    PROD_IDS[def.nameProduct] = res.data.id
    console.log(`  Created ${def.nameProduct} (ID: ${res.data.id})`)
  }

  // BOMs
  const bomDefs = [
    {
      productId: PROD_IDS['Espresso'], name: 'Resep Espresso',
      notes: '20g kopi bubuk, ekstrak 25-30 detik',
      lines: [{ ingredientId: ING_IDS['Kopi Bubuk'], qty: 20, unit: 'gram' }]
    },
    {
      productId: PROD_IDS['Cappuccino'], name: 'Resep Cappuccino',
      notes: '20g kopi + 150ml susu, steam hingga berbusa',
      lines: [
        { ingredientId: ING_IDS['Kopi Bubuk'], qty: 20, unit: 'gram' },
        { ingredientId: ING_IDS['Susu Cair'], qty: 150, unit: 'ml' }
      ]
    },
    {
      productId: PROD_IDS['Latte'], name: 'Resep Latte',
      notes: '20g kopi + 200ml susu, microfoam',
      lines: [
        { ingredientId: ING_IDS['Kopi Bubuk'], qty: 20, unit: 'gram' },
        { ingredientId: ING_IDS['Susu Cair'], qty: 200, unit: 'ml' }
      ]
    },
    {
      productId: PROD_IDS['Mocha'], name: 'Resep Mocha',
      notes: '20g kopi + 150ml susu + 15g coklat bubuk',
      lines: [
        { ingredientId: ING_IDS['Kopi Bubuk'], qty: 20, unit: 'gram' },
        { ingredientId: ING_IDS['Susu Cair'], qty: 150, unit: 'ml' },
        { ingredientId: ING_IDS['Coklat Bubuk'], qty: 15, unit: 'gram' }
      ]
    },
    {
      productId: PROD_IDS['Cold Brew'], name: 'Resep Cold Brew',
      notes: '50g kopi + 500ml air, diamkan 12-24 jam di kulkas',
      lines: [
        { ingredientId: ING_IDS['Kopi Bubuk'], qty: 50, unit: 'gram' },
        { ingredientId: ING_IDS['Air Mineral'], qty: 500, unit: 'ml' }
      ]
    }
  ]
  for (const def of bomDefs) {
    // Check if BOM already exists for this product
    const existingBoms = await api('GET', `/bom/get-all?limit=100`, undefined)
    const bomList = existingBoms?.data || []
    const existingBom = bomList.find(b => b.productId === def.productId)
    if (existingBom) { console.log(`  Using existing BOM for ${def.name} (ID: ${existingBom.id})`); continue }
    const res = await api('POST', '/bom/add', def)
    if (!res.success) { console.error(`BOM ${def.name} failed:`, res); return }
    console.log(`✅ BOM: ${def.name}`)
  }

  console.log('\n🎉 ALL DONE!')
}

main().catch(console.error)
