/**
 * Seed master data wilayah Indonesia (provinsi, kab/kota, kecamatan, desa + kode pos).
 *
 * NOTE: Provinsi & kab/kota (~552 baris) sudah di-seed otomatis via migration seeder
 *       (db/seeders/20260817000000-seed-regions.js) saat menjalankan `npm run migrate`.
 *       Script ini dibutuhkan HANYA untuk data kecamatan & desa (~91k baris) yang
 *       terlalu besar untuk di-bundle dalam migration seeder.
 *
 * Sumber data:
 *   - Nama & kode wilayah + kode pos: dataset Kemendagri dari
 *     https://github.com/vermaysha/database-wilayah-indonesia (JSON per level, termasuk kode pos).
 *   - Koordinat (latitude/longitude) provinsi, kab/kota, kecamatan: dataset
 *     https://github.com/open-admin-data/indonesia-administrative-divisions
 *     (dicocokkan berdasarkan nama + rantai parent, karena kode wilayahnya beda sistem).
 *
 * Cara pakai:
 *   node scripts/seed-regions.js                # seed semua wilayah (~92k baris) + koordinat
 *   node scripts/seed-regions.js --province=11  # seed 1 provinsi (untuk testing cepat)
 *   node scripts/seed-regions.js --skip-coords  # lewati pengunduhan koordinat
 *
 * Script bersifat idempotent: tabel region di-truncate lalu diisi ulang.
 */
require('dotenv').config({ path: __dirname + '/../.env' })

const db = require('../db/models')

const BASE_URL =
  'https://raw.githubusercontent.com/vermaysha/database-wilayah-indonesia/master/db/json'

const COORDS_URL =
  'https://raw.githubusercontent.com/open-admin-data/indonesia-administrative-divisions/main/data/all-flat.json'

const FILE_BY_LEVEL = [
  { level: 'province', file: '01province.json' },
  { level: 'city', file: '02regency.json' },
  { level: 'district', file: '03district.json' },
  { level: 'village', file: '04village.json' }
]

const BATCH_SIZE = 5000

// Alias nama provinsi agar cocok dengan penamaan di dataset koordinat (open-admin-data).
const PROV_ALIAS = {
  'dki jakarta': 'daerah khusus ibukota jakarta',
  'di yogyakarta': 'daerah istimewa yogyakarta'
}

// Alias nama kab/kota yang memang beda penamaan antar dataset (tetap wilayah yang sama).
const CITY_ALIAS = {
  'kabupaten toba samosir': 'kabupaten toba',
  'kabupaten mahakam hulu': 'kabupaten mahakam ulu'
}

function parseFlag(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split('=')[1] : null
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Gagal download ${url} (HTTP ${res.status})`)
  }
  return res.json()
}

function mapRow(level, raw) {
  switch (level) {
    case 'province':
      return {
        code: raw.province_id,
        name: raw.province_name,
        level,
        parentCode: null,
        postalCode: null
      }
    case 'city':
      return {
        code: raw.regency_id,
        name: raw.regency_name,
        level,
        parentCode: raw.province_id,
        postalCode: null
      }
    case 'district':
      return {
        code: raw.district_id,
        name: raw.district_name,
        level,
        parentCode: raw.regency_id,
        postalCode: null
      }
    case 'village':
      return {
        code: raw.village_id,
        name: raw.village_name,
        level,
        parentCode: raw.district_id,
        postalCode: raw.postal_code || null
      }
    default:
      throw new Error(`Level tidak dikenal: ${level}`)
  }
}

async function ensureLatLongColumns() {
  const [cols] = await db.sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'region' AND table_schema = 'public'`
  )
  const existing = cols.map((c) => c.column_name)
  if (!existing.includes('latitude')) {
    await db.sequelize.query(
      'ALTER TABLE "region" ADD COLUMN "latitude" DOUBLE PRECISION'
    )
  }
  if (!existing.includes('longitude')) {
    await db.sequelize.query(
      'ALTER TABLE "region" ADD COLUMN "longitude" DOUBLE PRECISION'
    )
  }
}

/**
 * Lengkapi latitude/longitude untuk level province, city, district.
 * Kode wilayah dataset koordinat beda sistem, jadi dicocokkan via nama + rantai parent.
 */
async function augmentCoordinates() {
  console.log('\n⬇️  Download data koordinat (open-admin-data)...')
  let flat
  try {
    const parsed = await fetchJson(COORDS_URL)
    flat = Array.isArray(parsed) ? parsed : parsed.data
  } catch (err) {
    console.warn(
      `⚠️  Gagal download koordinat, koordinat dilewati: ${err.message}`
    )
    return
  }

  const norm = (s) => {
    let n = (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
    n = n
      .replace(/[-–—]/g, ' ')
      .replace(/\badministrasi\b/g, ' ')
      .replace(/\bke?p\.?\s+/g, 'kepulauan ')
      .replace(/\s+/g, ' ')
      .trim()
    return PROV_ALIAS[n] || CITY_ALIAS[n] || n
  }
  const compact = (s) => norm(s).replace(/\s+/g, '')

  const provGeo = new Map() // provName -> {lat, lon}
  const cityGeo = new Map() // provName||cityName -> {lat, lon}
  const distGeo = new Map() // provName||cityName||districtName -> {lat, lon}
  const provGeoCompact = new Map()
  const cityGeoCompact = new Map()
  const distGeoCompact = new Map()

  for (const item of flat) {
    const geo = item.geo
    if (!geo || geo.lat == null || geo.lon == null) continue
    const ancestors = item.ancestors || []
    const provName = norm(ancestors.find((a) => a.level === 1)?.name?.local)
    const cityName = norm(ancestors.find((a) => a.level === 2)?.name?.local)
    const name = norm(item.name?.local)
    const lat = parseFloat(geo.lat)
    const lon = parseFloat(geo.lon)

    if (item.level === 1) {
      provGeo.set(name, { lat, lon })
      provGeoCompact.set(compact(name), { lat, lon })
    } else if (item.level === 2) {
      const key = `${provName}||${name}`
      cityGeo.set(key, { lat, lon })
      cityGeoCompact.set(compact(key), { lat, lon })
    } else if (item.level === 3) {
      const key = `${provName}||${cityName}||${name}`
      distGeo.set(key, { lat, lon })
      distGeoCompact.set(compact(key), { lat, lon })
    }
  }

  console.log(
    `📦 Koordinat siap: provinsi ${provGeo.size}, kab/kota ${cityGeo.size}, kecamatan ${distGeo.size}`
  )

  let updated = 0
  let skipped = 0

  const regions = await db.region.findAll({
    attributes: ['id', 'code', 'name', 'level', 'parentCode'],
    where: {
      level: { [db.Sequelize.Op.in]: ['province', 'city', 'district'] }
    },
    raw: true
  })

  const provinces = regions.filter((r) => r.level === 'province')
  const cities = regions.filter((r) => r.level === 'city')

  const provinceNameByCode = new Map(
    provinces.map((p) => [p.code, norm(p.name)])
  )
  const cityNameByCode = new Map(cities.map((c) => [c.code, norm(c.name)]))
  const provinceCodeOfCity = new Map(cities.map((c) => [c.code, c.parentCode]))

  for (const region of regions) {
    const name = norm(region.name)
    let key = null

    if (region.level === 'province') {
      key = name
      const geo = provGeo.get(key) || provGeoCompact.get(compact(key))
      if (geo) {
        await db.region.update(
          { latitude: geo.lat, longitude: geo.lon },
          { where: { id: region.id } }
        )
        updated++
      } else {
        skipped++
      }
    } else if (region.level === 'city') {
      const provName = provinceNameByCode.get(region.parentCode)
      key = `${provName}||${name}`
      const geo = cityGeo.get(key) || cityGeoCompact.get(compact(key))
      if (geo) {
        await db.region.update(
          { latitude: geo.lat, longitude: geo.lon },
          { where: { id: region.id } }
        )
        updated++
      } else {
        skipped++
      }
    } else {
      const cityName = cityNameByCode.get(region.parentCode)
      const provName = cityName
        ? provinceNameByCode.get(provinceCodeOfCity.get(region.parentCode))
        : null
      key = `${provName}||${cityName}||${name}`
      const geo = distGeo.get(key) || distGeoCompact.get(compact(key))
      if (geo) {
        await db.region.update(
          { latitude: geo.lat, longitude: geo.lon },
          { where: { id: region.id } }
        )
        updated++
      } else {
        skipped++
      }
    }
  }

  console.log(
    `📍 Koordinat terisi: ${updated.toLocaleString('id-ID')}, tidak cocok: ${skipped.toLocaleString('id-ID')}`
  )
}

async function main() {
  const provinceFilter = parseFlag('province')
  const skipCoords = process.argv.includes('--skip-coords')

  console.log('🔌 Menghubungkan ke database...')
  await db.sequelize.authenticate()
  console.log('✅ Terhubung!')

  console.log('🛠  Membuat tabel region (jika belum ada)...')
  await db.sequelize.sync()
  await ensureLatLongColumns()

  // Step 1: Download all data into memory first (before truncating!)
  const allLevelData = []
  for (const { level, file } of FILE_BY_LEVEL) {
    const url = `${BASE_URL}/${file}`
    console.log(`⬇️  Download ${file}...`)
    const raw = await fetchJson(url)

    let rows = raw.map((r) => mapRow(level, r))
    if (provinceFilter) {
      if (level === 'province') {
        rows = rows.filter((r) => r.code === provinceFilter)
      } else if (level === 'city') {
        rows = rows.filter((r) => r.parentCode === provinceFilter)
      } else {
        rows = rows.filter((r) => r.code.startsWith(provinceFilter))
      }
    }
    allLevelData.push({ level, rows })
    console.log(`✅ ${rows.length.toLocaleString('id-ID')} baris ${level} (di-download)`)
  }

  // Step 2: Now safe to truncate (all downloads succeeded)
  console.log('🧹 Menghapus data region lama...')
  await db.sequelize.query('TRUNCATE TABLE "region" RESTART IDENTITY')

  // Step 3: Insert all data
  let total = 0
  for (const { level, rows } of allLevelData) {
    if (rows.length === 0) continue
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE)
      await db.region.bulkCreate(chunk)
    }
    total += rows.length
  }

  if (!skipCoords) {
    await augmentCoordinates()
  }

  const finalTotal = await db.region.count()
  console.log(
    `\n🎉 Selesai! Total data region di database: ${finalTotal.toLocaleString('id-ID')}`
  )
}

main()
  .catch((err) => {
    console.error('❌ Seed gagal:', err.message || err)
    process.exit(1)
  })
  .finally(async () => {
    await db.sequelize.close()
  })
