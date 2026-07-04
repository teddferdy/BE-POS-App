#!/usr/bin/env node
require('dotenv').config({ path: __dirname + '/.env' })
const BASE = 'http://127.0.0.1:5001'
let TOKEN = ''

async function api(method, path, body, formData = false) {
  const url = BASE + path
  const opts = { method, headers: { Authorization: `Bearer ${TOKEN}`, Cookie: 'store=1' } }
  if (body && !formData) {
    opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body)
  } else if (body && formData) { opts.body = body }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, opts)
      const text = await res.text()
      try { return JSON.parse(text) } catch { return text }
    } catch (e) {
      if (attempt === 2) throw e
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

async function getOrCreateIngCat(name) {
  const list = (await api('GET', '/ingredient-category/get-all?limit=50', undefined)).data || []
  const ex = list.find(i => i.name === name)
  if (ex) { console.log(`  Using ingredient category: ${name} (ID: ${ex.id})`); return ex.id }
  const res = await api('POST', '/ingredient-category/add', { name, status: 'active' })
  if (!res.success) { console.log(`  Already exists (race): ${name}`); return null }
  console.log(`  Created ingredient category: ${name} (ID: ${res.data.id})`)
  return res.data.id
}

async function getOrCreateSupplier(name, phone) {
  const list = (await api('GET', '/supplier/?limit=50', undefined)).data || []
  const ex = list.find(i => i.name === name)
  if (ex) { console.log(`  Using supplier: ${name} (ID: ${ex.id})`); return ex.id }
  const res = await api('POST', '/supplier/', { name, phone, email: `${name.toLowerCase().replace(/\s+/g,'')}@supplier.com`, address: 'Jakarta', status: 'active' })
  if (!res.success) { console.error(`  FAIL: supplier ${name}`, res); return null }
  console.log(`  Created supplier: ${name} (ID: ${res.data.id})`)
  return res.data.id
}

async function getOrCreateIngredient(name, category, supplier, unit) {
  const list = (await api('GET', '/ingredient/get-all?limit=200', undefined)).data || []
  const ex = list.find(i => i.name === name)
  if (ex) { return ex.id }
  const res = await api('POST', '/ingredient/add', { name, category, supplier, stock: 99999, unit, costPrice: 1000, minStock: 1000 })
  if (!res.success) { console.error(`  FAIL: ingredient ${name}`, res); return null }
  console.log(`  Created ingredient: ${name} (ID: ${res.data.id})`)
  return res.data.id
}

async function getOrCreateProdCat(name) {
  const list = (await api('GET', '/category/get-category-all?pageSize=50', undefined)).data || []
  let ex = list.find(i => i.name === name)
  if (ex) { console.log(`  Using product category: ${name} (ID: ${ex.id})`); return ex.id }
  const f = new FormData(); f.append('name', name); f.append('description', name); f.append('status', 'active')
  const res = await api('POST', '/category/add-new-category', f, true)
  if (!res.success) { console.error(`  FAIL: prod cat ${name}`, res); return null }
  // re-fetch to get the new ID
  const newList = (await api('GET', '/category/get-category-all?pageSize=50', undefined)).data || []
  ex = newList.find(i => i.name === name)
  if (ex) { console.log(`  Created product category: ${name} (ID: ${ex.id})`); return ex.id }
  console.error(`  Created but could not find: ${name}`)
  return null
}

async function getOrCreateProduct(nameProduct, category, price) {
  const list = (await api('GET', '/product/get-product-all?pageSize=200', undefined)).data || []
  const ex = list.find(i => i.nameProduct === nameProduct)
  if (ex) { return ex.id }
  const fields = { nameProduct, category, price, costPrice: Math.round(price*0.3), unit: 'porsi', tipeProduk: 'menu', stock: 100 }
  const res = await api('POST', '/product/add-product', fields)
  if (!res.success) { console.error(`  FAIL: product ${nameProduct}`, res); return null }
  console.log(`  Created product: ${nameProduct} (ID: ${res.data.id})`)
  return res.data.id
}

async function createBOM(productId, name, lines) {
  const exist = (await api('GET', '/bom/get-all?limit=200', undefined)).data || []
  if (exist.find(b => b.productId === productId)) { return }
  const res = await api('POST', '/bom/add', { productId, name, lines })
  if (!res.success) { console.error(`  FAIL: BOM ${name}`, res); return }
  console.log(`  Created BOM: ${name}`)
}

async function main() {
  const login = await api('POST', '/auth/login', { userName: 'superadmin@posapp.com', password: 'superadmin123' })
  TOKEN = login.token
  if (!TOKEN) { console.error('Login failed:', login); return }
  console.log('✅ Login OK\n')

  // ============= INGREDIENT CATEGORIES =============
  console.log('=== INGREDIENT CATEGORIES ===')
  const IC_BEANS = await getOrCreateIngCat('Biji Kopi')
  const IC_MILK = await getOrCreateIngCat('Susu & Krim')
  const IC_SIRUP = await getOrCreateIngCat('Sirup & Perasa')
  const IC_TEH = await getOrCreateIngCat('Teh & Herbal')
  const IC_BUMBU = await getOrCreateIngCat('Bumbu & Rempah')
  const IC_BEKUK = await getOrCreateIngCat('Makanan Beku')
  const IC_SAYUR = await getOrCreateIngCat('Sayur & Buah')
  const IC_TEPUNG = await getOrCreateIngCat('Tepung & Roti')
  const IC_SAUS = await getOrCreateIngCat('Saus & Kondimen')
  const IC_PELENGKAP = await getOrCreateIngCat('Bahan Pelengkap')
  const IC_MINYAK = await getOrCreateIngCat('Minyak & Lemak')
  const IC_DAGING = await getOrCreateIngCat('Daging & Protein')
  const IC_PEMANIS = await getOrCreateIngCat('Pemanis')

  // ============= SUPPLIERS =============
  console.log('\n=== SUPPLIERS ===')
  const S_MAIN = await getOrCreateSupplier('PT Kopi Nusantara', '02112345678')
  const S_SUSU = await getOrCreateSupplier('Greenfields Dairy', '0211111111')
  const S_SIRUP = await getOrCreateSupplier('Monin Indonesia', '0212222222')
  const S_BEKUK = await getOrCreateSupplier('Indofood Frosted', '0213333333')
  const S_BUMBU = await getOrCreateSupplier('Bumbu Prima', '0214444444')
  const S_PROTEIN = await getOrCreateSupplier('So Good Food', '0215555555')
  const S_ROTI = await getOrCreateSupplier('Sari Roti', '0216666666')

  // ============= ALL INGREDIENTS =============
  console.log('\n=== INGREDIENTS ===')
  const i = {}
  // Beans & Coffee
  i.KOPI = await getOrCreateIngredient('Biji Kopi Espresso', IC_BEANS, S_MAIN, 'gram')
  i.AIR = await getOrCreateIngredient('Air Mineral', IC_PELENGKAP, S_BUMBU, 'ml')
  i.ES = await getOrCreateIngredient('Es Batu Kristal', IC_PELENGKAP, S_BEKUK, 'gram')

  // Milk & Cream
  i.SUSU = await getOrCreateIngredient('Susu UHT Full Cream', IC_MILK, S_SUSU, 'ml')
  i.SKM_PUTIH = await getOrCreateIngredient('Susu Kental Manis Putih', IC_MILK, S_SUSU, 'ml')
  i.SKM_COKLAT = await getOrCreateIngredient('Susu Kental Manis Cokelat', IC_MILK, S_SUSU, 'ml')
  i.COOKING_CREAM = await getOrCreateIngredient('Cooking Cream', IC_MILK, S_SUSU, 'ml')
  i.WHIPPED_CREAM = await getOrCreateIngredient('Whipped Cream', IC_MILK, S_SUSU, 'gram')
  i.YOGURT = await getOrCreateIngredient('Yogurt Plain', IC_MILK, S_SUSU, 'ml')
  i.KRIMER = await getOrCreateIngredient('Krimer Bubuk', IC_MILK, S_SUSU, 'gram')
  i.ES_KRIM_VANILA = await getOrCreateIngredient('Es Krim Vanila', IC_MILK, S_BEKUK, 'scoop')
  i.ES_KRIM_COKLAT = await getOrCreateIngredient('Es Krim Cokelat', IC_MILK, S_BEKUK, 'scoop')
  i.ES_KRIM_STROBERI = await getOrCreateIngredient('Es Krim Stroberi', IC_MILK, S_BEKUK, 'scoop')

  // Syrups & Sweeteners
  i.GULA_AREN = await getOrCreateIngredient('Gula Aren Cair Murni', IC_SIRUP, S_SIRUP, 'ml')
  i.SIRUP_VANILA = await getOrCreateIngredient('Sirup Vanila', IC_SIRUP, S_SIRUP, 'ml')
  i.SIRUP_GULA = await getOrCreateIngredient('Simple Syrup', IC_PEMANIS, S_BUMBU, 'ml')
  i.SIRUP_MINT = await getOrCreateIngredient('Sirup Mint', IC_SIRUP, S_SIRUP, 'ml')
  i.SIRUP_LECI = await getOrCreateIngredient('Sirup Leci', IC_SIRUP, S_SIRUP, 'ml')
  i.SIRUP_STROBERI = await getOrCreateIngredient('Sirup Strawberry', IC_SIRUP, S_SIRUP, 'ml')
  i.SAUS_KARAMEL = await getOrCreateIngredient('Saus Karamel', IC_SIRUP, S_SIRUP, 'ml')
  i.SAUS_COKLAT = await getOrCreateIngredient('Saus Cokelat', IC_SIRUP, S_SIRUP, 'ml')
  i.NUTELLA = await getOrCreateIngredient('Nutella', IC_SIRUP, S_SIRUP, 'gram')
  i.MADU = await getOrCreateIngredient('Madu Murni', IC_PEMANIS, S_BUMBU, 'ml')
  i.SIRUP_MAPEL = await getOrCreateIngredient('Sirup Mapel', IC_SIRUP, S_SIRUP, 'ml')
  i.GULA_PASIR = await getOrCreateIngredient('Gula Pasir', IC_PEMANIS, S_BUMBU, 'gram')
  i.GULA_PALEM = await getOrCreateIngredient('Gula Palem', IC_PEMANIS, S_BUMBU, 'gram')
  i.GULA_MERAH = await getOrCreateIngredient('Gula Merah', IC_PEMANIS, S_BUMBU, 'gram')

  // Powder & Baking
  i.MATCHA = await getOrCreateIngredient('Bubuk Matcha Premium', IC_TEPUNG, S_SIRUP, 'gram')
  i.COKLAT_BUBUK = await getOrCreateIngredient('Bubuk Cokelat Dark', IC_TEPUNG, S_BUMBU, 'gram')
  i.COKLAT_DCC = await getOrCreateIngredient('Dark Cooking Chocolate', IC_TEPUNG, S_BUMBU, 'gram')
  i.TEPUNG_TERIGU = await getOrCreateIngredient('Tepung Terigu Protein Sedang', IC_TEPUNG, S_ROTI, 'gram')
  i.TEPUNG_MAIZENA = await getOrCreateIngredient('Tepung Maizena', IC_TEPUNG, S_ROTI, 'gram')
  i.TEPUNG_ROTI = await getOrCreateIngredient('Tepung Roti Panir', IC_TEPUNG, S_ROTI, 'gram')
  i.TEPUNG_KARAGE = await getOrCreateIngredient('Tepung Karage Instan', IC_TEPUNG, S_BEKUK, 'gram')
  i.COKLAT_MESES = await getOrCreateIngredient('Meses Cokelat', IC_TEPUNG, S_BUMBU, 'gram')
  i.PREMIX_WAFFLE = await getOrCreateIngredient('Tepung Premix Waffle', IC_TEPUNG, S_ROTI, 'ml')

  // Tea & Herbal
  i.TEH_HITAM = await getOrCreateIngredient('Teh Hitam Celup', IC_TEH, S_BUMBU, 'ml')
  i.DAUN_MINT = await getOrCreateIngredient('Daun Mint Segar', IC_SAYUR, S_BUMBU, 'lembar')
  i.PETERSELI = await getOrCreateIngredient('Daun Peterseli', IC_SAYUR, S_BUMBU, 'gram')

  // Fruits & Vegetables
  i.ALPUKAT = await getOrCreateIngredient('Alpukat Matang', IC_SAYUR, S_BUMBU, 'gram')
  i.STROBERI_BEKU = await getOrCreateIngredient('Stroberi Frozen', IC_SAYUR, S_BEKUK, 'gram')
  i.STROBERI_SEGAR = await getOrCreateIngredient('Stroberi Segar', IC_SAYUR, S_BUMBU, 'gram')
  i.LECI_KALENG = await getOrCreateIngredient('Buah Leci Kaleng', IC_SAYUR, S_BEKUK, 'butir')
  i.JERUK_NIPIS = await getOrCreateIngredient('Jeruk Nipis', IC_SAYUR, S_BUMBU, 'gram')
  i.PISANG = await getOrCreateIngredient('Pisang Ambon', IC_SAYUR, S_BUMBU, 'buah')
  i.TOMAT = await getOrCreateIngredient('Tomat Segar', IC_SAYUR, S_BUMBU, 'gram')
  i.SELADA = await getOrCreateIngredient('Selada', IC_SAYUR, S_BUMBU, 'gram')
  i.BAWANG_BOMBAI = await getOrCreateIngredient('Bawang Bombai', IC_SAYUR, S_BUMBU, 'gram')
  i.BAWANG_PUTIH = await getOrCreateIngredient('Bawang Putih', IC_SAYUR, S_BUMBU, 'gram')
  i.BAWANG_MERAH = await getOrCreateIngredient('Bawang Merah', IC_SAYUR, S_BUMBU, 'gram')
  i.CABAI_RAWIT = await getOrCreateIngredient('Cabai Rawit Merah', IC_SAYUR, S_BUMBU, 'gram')
  i.CABAI_KERING = await getOrCreateIngredient('Cabai Kering Chili Flakes', IC_SAYUR, S_BUMBU, 'gram')
  i.DAUN_BAWANG = await getOrCreateIngredient('Daun Bawang', IC_SAYUR, S_BUMBU, 'gram')
  i.SAWI = await getOrCreateIngredient('Sawi Hijau', IC_SAYUR, S_BUMBU, 'gram')
  i.KOL = await getOrCreateIngredient('Kol', IC_SAYUR, S_BUMBU, 'gram')
  i.ASAM_JAWA = await getOrCreateIngredient('Asam Jawa', IC_SAYUR, S_BUMBU, 'gram')
  i.KACANG_ALMOND = await getOrCreateIngredient('Kacang Almond Iris', IC_TEPUNG, S_BUMBU, 'gram')
  i.KACANG_TANAH = await getOrCreateIngredient('Kacang Tanah Cincang', IC_TEPUNG, S_BUMBU, 'gram')

  // Spices & Seasonings
  i.GARAM = await getOrCreateIngredient('Garam Halus', IC_BUMBU, S_BUMBU, 'gram')
  i.KALDU_JAMUR = await getOrCreateIngredient('Kaldu Jamur Bubuk', IC_BUMBU, S_BUMBU, 'gram')
  i.MERICA = await getOrCreateIngredient('Merica Bubuk', IC_BUMBU, S_BUMBU, 'gram')
  i.OREGANO = await getOrCreateIngredient('Oregano Kering', IC_BUMBU, S_BUMBU, 'gram')
  i.KAYU_MANIS = await getOrCreateIngredient('Kayu Manis Bubuk', IC_BUMBU, S_BUMBU, 'gram')
  i.WIJEN = await getOrCreateIngredient('Wijen Sangrai', IC_BUMBU, S_BUMBU, 'gram')

  // Sauces & Condiments
  i.KECAP_MANIS = await getOrCreateIngredient('Kecap Manis', IC_SAUS, S_BUMBU, 'ml')
  i.KECAP_ASIN = await getOrCreateIngredient('Kecap Asin', IC_SAUS, S_BUMBU, 'ml')
  i.SAUS_TIRAM = await getOrCreateIngredient('Saus Tiram', IC_SAUS, S_BUMBU, 'ml')
  i.SAUS_BBQ = await getOrCreateIngredient('Saus Barbeku', IC_SAUS, S_BUMBU, 'gram')
  i.SAUS_SAMBAL = await getOrCreateIngredient('Saus Sambal', IC_SAUS, S_BUMBU, 'gram')
  i.SAUS_TOMAT = await getOrCreateIngredient('Saus Tomat', IC_SAUS, S_BUMBU, 'gram')
  i.SAUS_KEJU = await getOrCreateIngredient('Saus Keju Cair', IC_SAUS, S_BUMBU, 'ml')
  i.MAYONES = await getOrCreateIngredient('Mayones', IC_SAUS, S_BUMBU, 'gram')
  i.TERIYAKI = await getOrCreateIngredient('Saus Yakiniku Teriyaki', IC_SAUS, S_SIRUP, 'ml')
  i.SODA = await getOrCreateIngredient('Air Soda', IC_PELENGKAP, S_BUMBU, 'ml')

  // Oils & Fats
  i.MINYAK_GORENG = await getOrCreateIngredient('Minyak Goreng', IC_MINYAK, S_BUMBU, 'ml')
  i.MINYAK_Zaitun = await getOrCreateIngredient('Minyak Zaitun', IC_MINYAK, S_BUMBU, 'ml')
  i.MINYAK_WIJEN = await getOrCreateIngredient('Minyak Wijen', IC_MINYAK, S_BUMBU, 'ml')
  i.MENTEGA = await getOrCreateIngredient('Mentega Butter', IC_MINYAK, S_SUSU, 'gram')
  i.MARGARIN = await getOrCreateIngredient('Margarin', IC_MINYAK, S_BUMBU, 'gram')

  // Protein
  i.TELUR = await getOrCreateIngredient('Telur Ayam', IC_DAGING, S_PROTEIN, 'butir')
  i.DADA_AYAM = await getOrCreateIngredient('Dada Ayam Fillet', IC_DAGING, S_PROTEIN, 'gram')
  i.SAYAP_AYAM = await getOrCreateIngredient('Sayap Ayam Frozen', IC_DAGING, S_BEKUK, 'gram')
  i.SAPI_GILING = await getOrCreateIngredient('Daging Sapi Giling', IC_DAGING, S_PROTEIN, 'gram')
  i.SAPI_SLICE = await getOrCreateIngredient('Daging Sapi Slice', IC_DAGING, S_PROTEIN, 'gram')
  i.BEEF_PATTY = await getOrCreateIngredient('Beef Patty Frozen', IC_DAGING, S_BEKUK, 'gram')
  i.SMOKED_BEEF = await getOrCreateIngredient('Smoked Beef', IC_DAGING, S_PROTEIN, 'lembar')
  i.BAKSO = await getOrCreateIngredient('Bakso Sapi', IC_DAGING, S_BEKUK, 'gram')
  i.SOSIS = await getOrCreateIngredient('Sosis', IC_DAGING, S_BEKUK, 'gram')
  i.UDANG = await getOrCreateIngredient('Udang Kupas', IC_DAGING, S_PROTEIN, 'gram')
  i.NUGGET = await getOrCreateIngredient('Nugget Ayam', IC_DAGING, S_BEKUK, 'gram')
  i.CUMI = await getOrCreateIngredient('Cumi Frozen', IC_DAGING, S_BEKUK, 'gram')

  // Frozen & Processed
  i.KENTANG_BEKU = await getOrCreateIngredient('Kentang Beku Shoestring', IC_BEKUK, S_BEKUK, 'gram')
  i.CIRENG = await getOrCreateIngredient('Cireng Mentah Frozen', IC_BEKUK, S_BEKUK, 'gram')
  i.KERIPIK_TORTILLA = await getOrCreateIngredient('Keripik Tortilla', IC_BEKUK, S_BEKUK, 'gram')
  i.CROISSANT = await getOrCreateIngredient('Croissant Frozen Dough', IC_BEKUK, S_BEKUK, 'pcs')

  // Carbs
  i.NASI = await getOrCreateIngredient('Nasi Putih', IC_TEPUNG, S_BUMBU, 'gram')
  i.SPAGHETTI = await getOrCreateIngredient('Pasta Spaghetti', IC_TEPUNG, S_ROTI, 'gram')
  i.FETTUCCINE = await getOrCreateIngredient('Pasta Fettuccine', IC_TEPUNG, S_ROTI, 'gram')
  i.MIE_INSTAN = await getOrCreateIngredient('Mie Instan', IC_TEPUNG, S_BUMBU, 'bungkus')
  i.ROTI_BURGER = await getOrCreateIngredient('Roti Burger Bun', IC_TEPUNG, S_ROTI, 'pasang')
  i.ROTI_TAWAR = await getOrCreateIngredient('Roti Tawar Kupas', IC_TEPUNG, S_ROTI, 'lembar')
  i.ROTI_KASUR = await getOrCreateIngredient('Roti Kasur Blok', IC_TEPUNG, S_ROTI, 'gram')
  i.BAGUETTE = await getOrCreateIngredient('Roti Baguette', IC_TEPUNG, S_ROTI, 'gram')
  i.KEJU_CHEDDAR = await getOrCreateIngredient('Keju Cheddar Parut', IC_MILK, S_SUSU, 'gram')
  i.KEJU_SLICE = await getOrCreateIngredient('Keju Slice', IC_MILK, S_SUSU, 'lembar')
  i.KEJU_MOZZARELLA = await getOrCreateIngredient('Keju Mozzarella', IC_MILK, S_SUSU, 'gram')
  i.KEJU_PARMESAN = await getOrCreateIngredient('Keju Parmesan Bubuk', IC_MILK, S_SUSU, 'gram')
  i.TAHU = await getOrCreateIngredient('Tahu Putih', IC_SAYUR, S_BUMBU, 'gram')
  i.TOBIKO = await getOrCreateIngredient('Tobiko', IC_SAUS, S_BUMBU, 'gram')

  // ============= PRODUCT CATEGORIES =============
  console.log('\n=== PRODUCT CATEGORIES ===')
  const PC_KOPI = await getOrCreateProdCat('Coffee')
  const PC_NONCOFFEE = await getOrCreateProdCat('Non-Coffee')
  const PC_SNACK = await getOrCreateProdCat('Snack & Appetizer')
  const PC_MAIN = await getOrCreateProdCat('Main Course')
  const PC_DESSERT = await getOrCreateProdCat('Dessert')

  // ============= PRODUCTS & BOMS =============
  console.log('\n=== PRODUCTS & BOMS ===')

  // -- COFFEE --
  const p = {}
  p.ES_KOPI_SUSU_AREN = await getOrCreateProduct('Es Kopi Susu Gula Aren', PC_KOPI, 22000)
  if (p.ES_KOPI_SUSU_AREN) await createBOM(p.ES_KOPI_SUSU_AREN, 'Resep Es Kopi Susu Gula Aren', [
    { ingredientId: i.KOPI, qty: 20, unit: 'gram' },
    { ingredientId: i.SUSU, qty: 120, unit: 'ml' },
    { ingredientId: i.GULA_AREN, qty: 25, unit: 'ml' },
    { ingredientId: i.KRIMER, qty: 8, unit: 'gram' },
    { ingredientId: i.ES, qty: 150, unit: 'gram' },
  ])

  p.AVOCADO_COFFEE = await getOrCreateProduct('Avocado Coffee Iced', PC_KOPI, 28000)
  if (p.AVOCADO_COFFEE) await createBOM(p.AVOCADO_COFFEE, 'Resep Avocado Coffee', [
    { ingredientId: i.KOPI, qty: 18, unit: 'gram' },
    { ingredientId: i.ALPUKAT, qty: 60, unit: 'gram' },
    { ingredientId: i.ES_KRIM_VANILA, qty: 1, unit: 'scoop' },
    { ingredientId: i.SUSU, qty: 80, unit: 'ml' },
    { ingredientId: i.SKM_COKLAT, qty: 15, unit: 'ml' },
    { ingredientId: i.ES, qty: 100, unit: 'gram' },
  ])

  p.CARAMEL_MACCHIATO = await getOrCreateProduct('Iced Caramel Macchiato', PC_KOPI, 30000)
  if (p.CARAMEL_MACCHIATO) await createBOM(p.CARAMEL_MACCHIATO, 'Resep Caramel Macchiato', [
    { ingredientId: i.KOPI, qty: 20, unit: 'gram' },
    { ingredientId: i.SIRUP_VANILA, qty: 10, unit: 'ml' },
    { ingredientId: i.SAUS_KARAMEL, qty: 15, unit: 'ml' },
    { ingredientId: i.SUSU, qty: 130, unit: 'ml' },
    { ingredientId: i.ES, qty: 130, unit: 'gram' },
  ])

  p.CAPPUCCINO = await getOrCreateProduct('Hot Cappuccino', PC_KOPI, 25000)
  if (p.CAPPUCCINO) await createBOM(p.CAPPUCCINO, 'Resep Hot Cappuccino', [
    { ingredientId: i.KOPI, qty: 18, unit: 'gram' },
    { ingredientId: i.SUSU, qty: 180, unit: 'ml' },
    { ingredientId: i.COKLAT_BUBUK, qty: 1, unit: 'gram' },
  ])

  p.AMERICANO = await getOrCreateProduct('Iced Americano', PC_KOPI, 18000)
  if (p.AMERICANO) await createBOM(p.AMERICANO, 'Resep Iced Americano', [
    { ingredientId: i.KOPI, qty: 20, unit: 'gram' },
    { ingredientId: i.AIR, qty: 180, unit: 'ml' },
    { ingredientId: i.ES, qty: 150, unit: 'gram' },
  ])

  // -- NON-COFFEE --
  p.MATCHA_LATTE = await getOrCreateProduct('Iced Matcha Latte', PC_NONCOFFEE, 32000)
  if (p.MATCHA_LATTE) await createBOM(p.MATCHA_LATTE, 'Resep Iced Matcha Latte', [
    { ingredientId: i.MATCHA, qty: 8, unit: 'gram' },
    { ingredientId: i.SUSU, qty: 140, unit: 'ml' },
    { ingredientId: i.SIRUP_GULA, qty: 25, unit: 'ml' },
    { ingredientId: i.AIR, qty: 30, unit: 'ml' },
    { ingredientId: i.ES, qty: 140, unit: 'gram' },
  ])

  p.CHOCOLATE_LATTE = await getOrCreateProduct('Iced Premium Chocolate', PC_NONCOFFEE, 28000)
  if (p.CHOCOLATE_LATTE) await createBOM(p.CHOCOLATE_LATTE, 'Resep Iced Chocolate', [
    { ingredientId: i.COKLAT_BUBUK, qty: 20, unit: 'gram' },
    { ingredientId: i.SKM_PUTIH, qty: 15, unit: 'ml' },
    { ingredientId: i.SUSU, qty: 120, unit: 'ml' },
    { ingredientId: i.AIR, qty: 30, unit: 'ml' },
    { ingredientId: i.ES, qty: 140, unit: 'gram' },
  ])

  p.VIRGIN_MOJITO = await getOrCreateProduct('Virgin Mojito', PC_NONCOFFEE, 25000)
  if (p.VIRGIN_MOJITO) await createBOM(p.VIRGIN_MOJITO, 'Resep Virgin Mojito', [
    { ingredientId: i.DAUN_MINT, qty: 8, unit: 'lembar' },
    { ingredientId: i.JERUK_NIPIS, qty: 30, unit: 'gram' },
    { ingredientId: i.SIRUP_MINT, qty: 15, unit: 'ml' },
    { ingredientId: i.SIRUP_GULA, qty: 15, unit: 'ml' },
    { ingredientId: i.SODA, qty: 150, unit: 'ml' },
    { ingredientId: i.ES, qty: 150, unit: 'gram' },
  ])

  p.LYCHEE_TEA = await getOrCreateProduct('Iced Lychee Tea', PC_NONCOFFEE, 22000)
  if (p.LYCHEE_TEA) await createBOM(p.LYCHEE_TEA, 'Resep Iced Lychee Tea', [
    { ingredientId: i.TEH_HITAM, qty: 150, unit: 'ml' },
    { ingredientId: i.SIRUP_LECI, qty: 20, unit: 'ml' },
    { ingredientId: i.LECI_KALENG, qty: 2, unit: 'butir' },
    { ingredientId: i.SIRUP_GULA, qty: 10, unit: 'ml' },
    { ingredientId: i.ES, qty: 150, unit: 'gram' },
  ])

  p.STRAWBERRY_SMOOTHIE = await getOrCreateProduct('Strawberry Smoothies', PC_NONCOFFEE, 30000)
  if (p.STRAWBERRY_SMOOTHIE) await createBOM(p.STRAWBERRY_SMOOTHIE, 'Resep Strawberry Smoothies', [
    { ingredientId: i.STROBERI_BEKU, qty: 80, unit: 'gram' },
    { ingredientId: i.YOGURT, qty: 40, unit: 'ml' },
    { ingredientId: i.SUSU, qty: 80, unit: 'ml' },
    { ingredientId: i.SIRUP_STROBERI, qty: 25, unit: 'ml' },
    { ingredientId: i.ES, qty: 120, unit: 'gram' },
  ])

  // -- SNACKS --
  p.FRENCH_FRIES = await getOrCreateProduct('French Fries Jumbo', PC_SNACK, 20000)
  if (p.FRENCH_FRIES) await createBOM(p.FRENCH_FRIES, 'Resep French Fries', [
    { ingredientId: i.KENTANG_BEKU, qty: 200, unit: 'gram' },
    { ingredientId: i.MINYAK_GORENG, qty: 20, unit: 'ml' },
    { ingredientId: i.GARAM, qty: 2, unit: 'gram' },
  ])

  p.TAHU_CABE_GARAM = await getOrCreateProduct('Tahu Cabe Garam', PC_SNACK, 18000)
  if (p.TAHU_CABE_GARAM) await createBOM(p.TAHU_CABE_GARAM, 'Resep Tahu Cabe Garam', [
    { ingredientId: i.TAHU, qty: 250, unit: 'gram' },
    { ingredientId: i.TEPUNG_MAIZENA, qty: 40, unit: 'gram' },
    { ingredientId: i.BAWANG_PUTIH, qty: 15, unit: 'gram' },
    { ingredientId: i.CABAI_RAWIT, qty: 10, unit: 'gram' },
    { ingredientId: i.DAUN_BAWANG, qty: 10, unit: 'gram' },
    { ingredientId: i.GARAM, qty: 2, unit: 'gram' },
    { ingredientId: i.KALDU_JAMUR, qty: 1, unit: 'gram' },
  ])

  p.CIRENG = await getOrCreateProduct('Cireng Bumbu Rujak', PC_SNACK, 15000)
  if (p.CIRENG) await createBOM(p.CIRENG, 'Resep Cireng Bumbu Rujak', [
    { ingredientId: i.CIRENG, qty: 200, unit: 'gram' },
    { ingredientId: i.MINYAK_GORENG, qty: 25, unit: 'ml' },
    { ingredientId: i.GULA_MERAH, qty: 40, unit: 'gram' },
    { ingredientId: i.CABAI_RAWIT, qty: 5, unit: 'gram' },
    { ingredientId: i.BAWANG_PUTIH, qty: 5, unit: 'gram' },
    { ingredientId: i.ASAM_JAWA, qty: 5, unit: 'gram' },
    { ingredientId: i.AIR, qty: 30, unit: 'ml' },
  ])

  p.CHICKEN_WINGS = await getOrCreateProduct('Spicy Chicken Wings', PC_SNACK, 28000)
  if (p.CHICKEN_WINGS) await createBOM(p.CHICKEN_WINGS, 'Resep Chicken Wings', [
    { ingredientId: i.SAYAP_AYAM, qty: 160, unit: 'gram' },
    { ingredientId: i.SAUS_BBQ, qty: 30, unit: 'gram' },
    { ingredientId: i.SAUS_SAMBAL, qty: 15, unit: 'gram' },
    { ingredientId: i.MADU, qty: 10, unit: 'ml' },
    { ingredientId: i.MINYAK_GORENG, qty: 15, unit: 'ml' },
  ])

  p.NACHOS = await getOrCreateProduct('Nachos Supreme', PC_SNACK, 25000)
  if (p.NACHOS) await createBOM(p.NACHOS, 'Resep Nachos Supreme', [
    { ingredientId: i.KERIPIK_TORTILLA, qty: 80, unit: 'gram' },
    { ingredientId: i.SAPI_GILING, qty: 40, unit: 'gram' },
    { ingredientId: i.SAUS_KEJU, qty: 40, unit: 'ml' },
    { ingredientId: i.BAWANG_BOMBAI, qty: 15, unit: 'gram' },
    { ingredientId: i.TOMAT, qty: 20, unit: 'gram' },
  ])

  // -- MAIN COURSE --
  p.KARAGE_MENTAI = await getOrCreateProduct('Rice Bowl Chicken Karage Mentai', PC_MAIN, 35000)
  if (p.KARAGE_MENTAI) await createBOM(p.KARAGE_MENTAI, 'Resep Chicken Karage Mentai', [
    { ingredientId: i.NASI, qty: 180, unit: 'gram' },
    { ingredientId: i.DADA_AYAM, qty: 120, unit: 'gram' },
    { ingredientId: i.TEPUNG_KARAGE, qty: 35, unit: 'gram' },
    { ingredientId: i.MAYONES, qty: 30, unit: 'gram' },
    { ingredientId: i.SAUS_SAMBAL, qty: 10, unit: 'gram' },
    { ingredientId: i.TOBIKO, qty: 5, unit: 'gram' },
    { ingredientId: i.MINYAK_GORENG, qty: 20, unit: 'ml' },
  ])

  p.GYUDON = await getOrCreateProduct('Rice Bowl Beef Yakiniku', PC_MAIN, 38000)
  if (p.GYUDON) await createBOM(p.GYUDON, 'Resep Beef Yakiniku', [
    { ingredientId: i.NASI, qty: 180, unit: 'gram' },
    { ingredientId: i.SAPI_SLICE, qty: 100, unit: 'gram' },
    { ingredientId: i.BAWANG_BOMBAI, qty: 30, unit: 'gram' },
    { ingredientId: i.TERIYAKI, qty: 35, unit: 'ml' },
    { ingredientId: i.MINYAK_WIJEN, qty: 5, unit: 'ml' },
    { ingredientId: i.WIJEN, qty: 1, unit: 'gram' },
  ])

  p.AGLIO_OLIO = await getOrCreateProduct('Spaghetti Aglio Olio', PC_MAIN, 32000)
  if (p.AGLIO_OLIO) await createBOM(p.AGLIO_OLIO, 'Resep Spaghetti Aglio Olio', [
    { ingredientId: i.SPAGHETTI, qty: 90, unit: 'gram' },
    { ingredientId: i.UDANG, qty: 30, unit: 'gram' },
    { ingredientId: i.MINYAK_Zaitun, qty: 20, unit: 'ml' },
    { ingredientId: i.BAWANG_PUTIH, qty: 10, unit: 'gram' },
    { ingredientId: i.CABAI_KERING, qty: 3, unit: 'gram' },
    { ingredientId: i.PETERSELI, qty: 2, unit: 'gram' },
  ])

  p.CARBONARA = await getOrCreateProduct('Fettuccine Carbonara', PC_MAIN, 35000)
  if (p.CARBONARA) await createBOM(p.CARBONARA, 'Resep Fettuccine Carbonara', [
    { ingredientId: i.FETTUCCINE, qty: 90, unit: 'gram' },
    { ingredientId: i.SMOKED_BEEF, qty: 2, unit: 'lembar' },
    { ingredientId: i.COOKING_CREAM, qty: 50, unit: 'ml' },
    { ingredientId: i.SUSU, qty: 80, unit: 'ml' },
    { ingredientId: i.KEJU_PARMESAN, qty: 15, unit: 'gram' },
    { ingredientId: i.TELUR, qty: 1, unit: 'butir' },
    { ingredientId: i.MENTEGA, qty: 10, unit: 'gram' },
  ])

  p.CORDON_BLEU = await getOrCreateProduct('Chicken Cordon Bleu', PC_MAIN, 40000)
  if (p.CORDON_BLEU) await createBOM(p.CORDON_BLEU, 'Resep Chicken Cordon Bleu', [
    { ingredientId: i.DADA_AYAM, qty: 150, unit: 'gram' },
    { ingredientId: i.SMOKED_BEEF, qty: 1, unit: 'lembar' },
    { ingredientId: i.KEJU_MOZZARELLA, qty: 25, unit: 'gram' },
    { ingredientId: i.TEPUNG_TERIGU, qty: 20, unit: 'gram' },
    { ingredientId: i.TELUR, qty: 1, unit: 'butir' },
    { ingredientId: i.TEPUNG_ROTI, qty: 40, unit: 'gram' },
    { ingredientId: i.MINYAK_GORENG, qty: 40, unit: 'ml' },
  ])

  p.NASGOR = await getOrCreateProduct('Nasi Goreng Spesial Kafe', PC_MAIN, 30000)
  if (p.NASGOR) await createBOM(p.NASGOR, 'Resep Nasi Goreng Spesial', [
    { ingredientId: i.NASI, qty: 220, unit: 'gram' },
    { ingredientId: i.TELUR, qty: 2, unit: 'butir' },
    { ingredientId: i.DADA_AYAM, qty: 30, unit: 'gram' },
    { ingredientId: i.BAKSO, qty: 30, unit: 'gram' },
    { ingredientId: i.BAWANG_PUTIH, qty: 10, unit: 'gram' },
    { ingredientId: i.KECAP_MANIS, qty: 15, unit: 'ml' },
    { ingredientId: i.SAUS_TIRAM, qty: 5, unit: 'ml' },
    { ingredientId: i.KECAP_ASIN, qty: 5, unit: 'ml' },
    { ingredientId: i.MARGARIN, qty: 15, unit: 'gram' },
  ])

  p.BURGER = await getOrCreateProduct('Beef Burger & Fries', PC_MAIN, 35000)
  if (p.BURGER) await createBOM(p.BURGER, 'Resep Beef Burger', [
    { ingredientId: i.ROTI_BURGER, qty: 1, unit: 'pasang' },
    { ingredientId: i.BEEF_PATTY, qty: 100, unit: 'gram' },
    { ingredientId: i.KEJU_SLICE, qty: 1, unit: 'lembar' },
    { ingredientId: i.SELADA, qty: 15, unit: 'gram' },
    { ingredientId: i.TOMAT, qty: 15, unit: 'gram' },
    { ingredientId: i.BAWANG_BOMBAI, qty: 10, unit: 'gram' },
    { ingredientId: i.MAYONES, qty: 20, unit: 'gram' },
    { ingredientId: i.KENTANG_BEKU, qty: 50, unit: 'gram' },
    { ingredientId: i.MINYAK_GORENG, qty: 10, unit: 'ml' },
  ])

  p.CLUB_SANDWICH = await getOrCreateProduct('Club Sandwich', PC_MAIN, 32000)
  if (p.CLUB_SANDWICH) await createBOM(p.CLUB_SANDWICH, 'Resep Club Sandwich', [
    { ingredientId: i.ROTI_TAWAR, qty: 3, unit: 'lembar' },
    { ingredientId: i.DADA_AYAM, qty: 40, unit: 'gram' },
    { ingredientId: i.SMOKED_BEEF, qty: 1, unit: 'lembar' },
    { ingredientId: i.TELUR, qty: 1, unit: 'butir' },
    { ingredientId: i.MAYONES, qty: 15, unit: 'gram' },
    { ingredientId: i.SAUS_TOMAT, qty: 10, unit: 'gram' },
    { ingredientId: i.SELADA, qty: 10, unit: 'gram' },
    { ingredientId: i.TOMAT, qty: 10, unit: 'gram' },
  ])

  p.MIE_GORENG = await getOrCreateProduct('Mie Goreng Dok-Dok', PC_MAIN, 20000)
  if (p.MIE_GORENG) await createBOM(p.MIE_GORENG, 'Resep Mie Goreng Dok-Dok', [
    { ingredientId: i.MIE_INSTAN, qty: 1, unit: 'bungkus' },
    { ingredientId: i.TELUR, qty: 1, unit: 'butir' },
    { ingredientId: i.SAWI, qty: 30, unit: 'gram' },
    { ingredientId: i.KOL, qty: 15, unit: 'gram' },
    { ingredientId: i.SOSIS, qty: 20, unit: 'gram' },
    { ingredientId: i.BAKSO, qty: 20, unit: 'gram' },
    { ingredientId: i.KECAP_MANIS, qty: 10, unit: 'ml' },
    { ingredientId: i.SAUS_SAMBAL, qty: 10, unit: 'ml' },
    { ingredientId: i.BAWANG_MERAH, qty: 5, unit: 'gram' },
    { ingredientId: i.BAWANG_PUTIH, qty: 5, unit: 'gram' },
  ])

  // -- DESSERT --
  p.CROFFLE = await getOrCreateProduct('Croffle Premium', PC_DESSERT, 25000)
  if (p.CROFFLE) await createBOM(p.CROFFLE, 'Resep Croffle', [
    { ingredientId: i.CROISSANT, qty: 3, unit: 'pcs' },
    { ingredientId: i.GULA_PASIR, qty: 15, unit: 'gram' },
    { ingredientId: i.NUTELLA, qty: 20, unit: 'gram' },
    { ingredientId: i.KACANG_ALMOND, qty: 5, unit: 'gram' },
  ])

  p.ROTI_BAKAR = await getOrCreateProduct('Roti Bakar Bandung', PC_DESSERT, 18000)
  if (p.ROTI_BAKAR) await createBOM(p.ROTI_BAKAR, 'Resep Roti Bakar Bandung', [
    { ingredientId: i.ROTI_KASUR, qty: 120, unit: 'gram' },
    { ingredientId: i.MARGARIN, qty: 25, unit: 'gram' },
    { ingredientId: i.COKLAT_MESES, qty: 30, unit: 'gram' },
    { ingredientId: i.KEJU_CHEDDAR, qty: 30, unit: 'gram' },
    { ingredientId: i.SKM_PUTIH, qty: 20, unit: 'ml' },
  ])

  p.WAFFLE = await getOrCreateProduct('Waffle with Ice Cream', PC_DESSERT, 30000)
  if (p.WAFFLE) await createBOM(p.WAFFLE, 'Resep Waffle', [
    { ingredientId: i.PREMIX_WAFFLE, qty: 130, unit: 'ml' },
    { ingredientId: i.ES_KRIM_VANILA, qty: 1, unit: 'scoop' },
    { ingredientId: i.SIRUP_MAPEL, qty: 20, unit: 'ml' },
    { ingredientId: i.STROBERI_SEGAR, qty: 15, unit: 'gram' },
  ])

  p.BROWNIES = await getOrCreateProduct('Fudgy Brownies Slice', PC_DESSERT, 22000)
  if (p.BROWNIES) await createBOM(p.BROWNIES, 'Resep Fudgy Brownies', [
    { ingredientId: i.COKLAT_DCC, qty: 25, unit: 'gram' },
    { ingredientId: i.MENTEGA, qty: 15, unit: 'gram' },
    { ingredientId: i.TEPUNG_TERIGU, qty: 15, unit: 'gram' },
    { ingredientId: i.GULA_PASIR, qty: 20, unit: 'gram' },
    { ingredientId: i.COKLAT_BUBUK, qty: 10, unit: 'gram' },
    { ingredientId: i.TELUR, qty: 1, unit: 'butir' },
  ])

  p.GARLIC_BREAD = await getOrCreateProduct('Garlic Bread', PC_SNACK, 15000)
  if (p.GARLIC_BREAD) await createBOM(p.GARLIC_BREAD, 'Resep Garlic Bread', [
    { ingredientId: i.BAGUETTE, qty: 80, unit: 'gram' },
    { ingredientId: i.MENTEGA, qty: 20, unit: 'gram' },
    { ingredientId: i.BAWANG_PUTIH, qty: 5, unit: 'gram' },
    { ingredientId: i.PETERSELI, qty: 1, unit: 'gram' },
  ])

  p.BANANA_SPLIT = await getOrCreateProduct('Banana Split', PC_DESSERT, 28000)
  if (p.BANANA_SPLIT) await createBOM(p.BANANA_SPLIT, 'Resep Banana Split', [
    { ingredientId: i.PISANG, qty: 1, unit: 'buah' },
    { ingredientId: i.ES_KRIM_VANILA, qty: 1, unit: 'scoop' },
    { ingredientId: i.ES_KRIM_COKLAT, qty: 1, unit: 'scoop' },
    { ingredientId: i.ES_KRIM_STROBERI, qty: 1, unit: 'scoop' },
    { ingredientId: i.WHIPPED_CREAM, qty: 15, unit: 'gram' },
    { ingredientId: i.SAUS_COKLAT, qty: 15, unit: 'ml' },
    { ingredientId: i.KACANG_TANAH, qty: 5, unit: 'gram' },
  ])

  console.log('\n🎉 ALL DONE!')
  console.log(`Products created: ${Object.keys(p).length}`)
}

main().catch(console.error)
