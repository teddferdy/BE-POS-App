const excelJS = require('exceljs')

const UNIT_OPTIONS = [
  'pcs',
  'item',
  'unit',
  'buah',
  'pasang',
  'set',
  'lusin',
  'pack',
  'box',
  'karton',
  'kg',
  'gram',
  'liter',
  'ml',
  'meter',
  'cm',
  'cup',
  'gelas',
  'porsi'
]

const BASE_UNIT_OPTIONS = ['pcs', 'gram', 'ml', 'cm', 'buah', 'lembar']

const TEMPLATE_HEADERS = [
  { key: 'no', header: 'No.', width: 8 },
  { key: 'nameProduct', header: 'Nama Produk', width: 25 },
  { key: 'sku', header: 'SKU', width: 15 },
  { key: 'barcode', header: 'Barcode', width: 18 },
  { key: 'brand', header: 'Brand/Merek', width: 15 },
  { key: 'category', header: 'Kategori', width: 20 },
  { key: 'tipeProduk', header: 'Tipe Produk', width: 15 },
  { key: 'description', header: 'Deskripsi', width: 30 },
  { key: 'store', header: 'Store', width: 20 },
  { key: 'unit', header: 'Satuan', width: 12 },
  { key: 'baseUnit', header: 'Base Satuan', width: 12 },
  { key: 'conversionFactor', header: 'Faktor Konversi', width: 15 },
  { key: 'supplier', header: 'Supplier', width: 18 },
  { key: 'tax', header: 'Pajak', width: 18 },
  { key: 'price', header: 'Harga', width: 15 },
  { key: 'costPrice', header: 'Harga Beli', width: 15 },
  { key: 'stock', header: 'Stok', width: 12 },
  { key: 'minStock', header: 'Min Stok', width: 12 },
  { key: 'point', header: 'Point', width: 10 },
  { key: 'redeemPoints', header: 'Point Redeem', width: 12 },
  { key: 'status', header: 'Status', width: 10 },
  { key: 'isAvailable', header: 'Tersedia', width: 10 },
  { key: 'isOption', header: 'Opsi', width: 10 },
  { key: 'options', header: 'Daftar Opsi', width: 25 }
]

const REQUIRED_HEADERS = ['No.', 'Nama Produk', 'Kategori', 'Harga']

const validateTemplateHeaders = (headers) => {
  const headerNames = headers.map((h) => h.toString().trim())
  return REQUIRED_HEADERS.every((required) => headerNames.includes(required))
}

const downloadProductTemplate = async ({
  categories = [],
  existingProducts = [],
  suppliers = [],
  taxConfigs = [],
  stores = []
} = {}) => {
  const workbook = new excelJS.Workbook()
  const worksheet = workbook.addWorksheet('Produk')

  worksheet.columns = TEMPLATE_HEADERS.map((h) => ({
    header: h.header,
    key: h.key,
    width: h.width
  }))

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4472C4' }
  }
  headerRow.alignment = { horizontal: 'center' }
  headerRow.height = 25

  const categoryDropdown = categories.map((c) => c.name).join(',')
  const supplierDropdown = suppliers.map((s) => s.name).join(',')
  const taxDropdown = taxConfigs.map((t) => `${t.name} (${t.rate}%)`).join(',')
  const unitDropdown = UNIT_OPTIONS.join(',')
  const baseUnitDropdown = BASE_UNIT_OPTIONS.join(',')
  const storeNames = stores.map((s) => s.name)
  const storeDropdown = ['All Stores', ...storeNames].join(',')

  const applyDataValidation = (row) => {
    const validations = {
      F: categoryDropdown && `"${categoryDropdown}"`,
      G: '"menu,bahan_baku"',
      I: storeDropdown && `"${storeDropdown}"`,
      J: `"${unitDropdown}"`,
      K: `"${baseUnitDropdown}"`,
      M: supplierDropdown && `"${supplierDropdown}"`,
      N: taxDropdown && `"${taxDropdown}"`,
      U: '"Aktif,Nonaktif,Draft"',
      V: '"Ya,Tidak"',
      W: '"Ya,Tidak"'
    }
    Object.entries(validations).forEach(([col, formula]) => {
      if (formula) {
        worksheet.getCell(`${col}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula]
        }
      }
    })
  }

  const maxRows = Math.max(existingProducts.length + 2, 12)
  for (let row = 2; row <= maxRows; row++) {
    worksheet.getCell(`A${row}`).value = row - 1
    applyDataValidation(row)
  }

  const storeNameById = {}
  stores.forEach((s) => {
    storeNameById[s.id] = s.name
  })

  const formatStores = (storeVal) => {
    if (!storeVal || !Array.isArray(storeVal) || storeVal.length === 0)
      return 'All Stores'
    return storeVal.map((id) => storeNameById[id] || `Store #${id}`).join(', ')
  }

  existingProducts.forEach((prod, index) => {
    const r = index + 2
    worksheet.getCell(`A${r}`).value = prod.id || r - 1
    worksheet.getCell(`B${r}`).value = prod.nameProduct
    worksheet.getCell(`C${r}`).value = prod.sku || ''
    worksheet.getCell(`D${r}`).value = prod.barcode || ''
    worksheet.getCell(`E${r}`).value = prod.brand || ''
    worksheet.getCell(`F${r}`).value = prod.categoryName || ''
    worksheet.getCell(`G${r}`).value = prod.tipeProduk || 'menu'
    worksheet.getCell(`H${r}`).value = prod.description || ''
    worksheet.getCell(`I${r}`).value = formatStores(prod.store)
    worksheet.getCell(`J${r}`).value = prod.unit || 'pcs'
    worksheet.getCell(`K${r}`).value = prod.baseUnit || 'pcs'
    worksheet.getCell(`L${r}`).value = prod.conversionFactor || 1
    worksheet.getCell(`M${r}`).value = prod.supplierName || ''
    worksheet.getCell(`N${r}`).value = prod.taxName || ''
    worksheet.getCell(`O${r}`).value = prod.price || 0
    worksheet.getCell(`P${r}`).value = prod.costPrice || 0
    worksheet.getCell(`Q${r}`).value = prod.stock || 0
    worksheet.getCell(`R${r}`).value = prod.minStock || 0
    worksheet.getCell(`S${r}`).value = prod.point || 0
    worksheet.getCell(`T${r}`).value = prod.redeemPoints || 0
    worksheet.getCell(`U${r}`).value =
      prod.status === 'draft'
        ? 'Draft'
        : prod.status === 'active'
          ? 'Aktif'
          : 'Nonaktif'
    worksheet.getCell(`V${r}`).value =
      prod.isAvailable !== false ? 'Ya' : 'Tidak'
    worksheet.getCell(`W${r}`).value = prod.isOption ? 'Ya' : 'Tidak'
    worksheet.getCell(`X${r}`).value = prod.options
      ? Array.isArray(prod.options)
        ? JSON.stringify(prod.options)
        : prod.options
      : ''
  })

  return workbook.xlsx.writeBuffer()
}

const parseProductTemplate = async (buffer) => {
  const workbook = new excelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.getWorksheet('Produk')
  if (!worksheet) {
    throw new Error('Sheet "Produk" tidak ditemukan')
  }

  const headers = []
  worksheet.getRow(1).eachCell((cell) => {
    headers.push(cell.value ? String(cell.value).trim() : '')
  })

  if (!validateTemplateHeaders(headers)) {
    throw new Error(
      'Header template tidak valid. Pastikan menggunakan template yang benar'
    )
  }

  // ponytail: detect Store column by header name for old/new template compat
  const storeColIdx = headers.findIndex((h) => h.toLowerCase() === 'store')

  // Column index map (1-indexed rowData positions, no-Store template base)
  // ponytail: assumes Store at column I (index 9); shifts cols 9+ right if Store exists
  const COL = {
    NAME: 2,
    SKU: 3,
    BARCODE: 4,
    BRAND: 5,
    CATEGORY: 6,
    TIPE: 7,
    DESC: 8,
    UNIT: 9,
    BASE_UNIT: 10,
    CONV_FACTOR: 11,
    SUPPLIER: 12,
    TAX: 13,
    PRICE: 14,
    COST_PRICE: 15,
    STOCK: 16,
    MIN_STOCK: 17,
    POINT: 18,
    REDEEM: 19,
    STATUS: 20,
    AVAILABLE: 21,
    OPTION: 22,
    OPTIONS: 23
  }

  const idx = (base) => (storeColIdx >= 0 && base >= 9 ? base + 1 : base)

  const products = []
  const startRow = 2

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= startRow) {
      const rowData = row.values
      if (rowData[1] || rowData[2]) {
        const storeVal =
          storeColIdx >= 0 && rowData[storeColIdx + 1]
            ? String(rowData[storeColIdx + 1]).trim()
            : ''

        products.push({
          no: rowData[1],
          nameProduct: rowData[COL.NAME]
            ? String(rowData[COL.NAME]).trim()
            : '',
          sku: rowData[COL.SKU] ? String(rowData[COL.SKU]).trim() : '',
          barcode: rowData[COL.BARCODE]
            ? String(rowData[COL.BARCODE]).trim()
            : '',
          brand: rowData[COL.BRAND] ? String(rowData[COL.BRAND]).trim() : '',
          category: rowData[COL.CATEGORY]
            ? String(rowData[COL.CATEGORY]).trim()
            : '',
          tipeProduk: rowData[COL.TIPE]
            ? String(rowData[COL.TIPE]).trim()
            : 'menu',
          description: rowData[COL.DESC]
            ? String(rowData[COL.DESC]).trim()
            : '',
          store: storeVal,
          unit: rowData[idx(COL.UNIT)]
            ? String(rowData[idx(COL.UNIT)]).trim()
            : 'pcs',
          baseUnit: rowData[idx(COL.BASE_UNIT)]
            ? String(rowData[idx(COL.BASE_UNIT)]).trim()
            : 'pcs',
          conversionFactor: rowData[idx(COL.CONV_FACTOR)]
            ? parseFloat(rowData[idx(COL.CONV_FACTOR)])
            : 1,
          supplier: rowData[idx(COL.SUPPLIER)]
            ? String(rowData[idx(COL.SUPPLIER)]).trim()
            : '',
          tax: rowData[idx(COL.TAX)]
            ? String(rowData[idx(COL.TAX)]).trim()
            : '',
          price: rowData[idx(COL.PRICE)]
            ? parseFloat(rowData[idx(COL.PRICE)])
            : 0,
          costPrice: rowData[idx(COL.COST_PRICE)]
            ? parseFloat(rowData[idx(COL.COST_PRICE)])
            : 0,
          stock: rowData[idx(COL.STOCK)]
            ? parseFloat(rowData[idx(COL.STOCK)])
            : 0,
          minStock: rowData[idx(COL.MIN_STOCK)]
            ? parseFloat(rowData[idx(COL.MIN_STOCK)])
            : 0,
          point: rowData[idx(COL.POINT)]
            ? parseFloat(rowData[idx(COL.POINT)])
            : 0,
          redeemPoints: rowData[idx(COL.REDEEM)]
            ? parseFloat(rowData[idx(COL.REDEEM)])
            : 0,
          status: rowData[idx(COL.STATUS)]
            ? String(rowData[idx(COL.STATUS)]).trim()
            : 'Aktif',
          isAvailable: rowData[idx(COL.AVAILABLE)]
            ? String(rowData[idx(COL.AVAILABLE)]).trim()
            : 'Ya',
          isOption: rowData[idx(COL.OPTION)]
            ? String(rowData[idx(COL.OPTION)]).trim()
            : 'Tidak',
          options: rowData[idx(COL.OPTIONS)]
            ? String(rowData[idx(COL.OPTIONS)]).trim()
            : ''
        })
      }
    }
  })

  return products
}

const LOCATION_HEADERS = [
  { key: 'no', header: 'No.', width: 8 },
  { key: 'id', header: 'ID', width: 15 },
  { key: 'name', header: 'Nama Toko', width: 25 },
  { key: 'image', header: 'Gambar (URL)', width: 30 },
  { key: 'address', header: 'Alamat', width: 30 },
  { key: 'detailLocation', header: 'Detail Lokasi', width: 25 },
  { key: 'phoneNumber', header: 'No. Telepon', width: 18 },
  { key: 'status', header: 'Status', width: 12 }
]

const LOCATION_REQUIRED_HEADERS = [
  'No.',
  'ID',
  'Nama Toko',
  'Gambar (URL)',
  'Alamat',
  'Detail Lokasi',
  'No. Telepon',
  'Status'
]

const validateLocationHeaders = (headers) => {
  const headerNames = headers.map((h) => h.toString().trim())
  return LOCATION_REQUIRED_HEADERS.every((required) =>
    headerNames.includes(required)
  )
}

const downloadLocationTemplate = async (existingLocations = []) => {
  const workbook = new excelJS.Workbook()
  const worksheet = workbook.addWorksheet('Lokasi')

  worksheet.columns = LOCATION_HEADERS.map((h) => ({
    header: h.header,
    key: h.key,
    width: h.width
  }))

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4472C4' }
  }
  headerRow.alignment = { horizontal: 'center' }
  headerRow.height = 25

  const maxRows = Math.max(existingLocations.length + 2, 12)
  for (let row = 2; row <= maxRows; row++) {
    worksheet.getCell(`A${row}`).value = row - 1
    worksheet.getCell(`H${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formula1: ['"Aktif,Nonaktif,Draft"'],
      showDropDown: true
    }
  }

  existingLocations.forEach((loc, index) => {
    const rowNum = index + 2
    worksheet.getCell(`B${rowNum}`).value = loc.id
    worksheet.getCell(`C${rowNum}`).value = loc.name
    worksheet.getCell(`D${rowNum}`).value = loc.image || ''
    worksheet.getCell(`E${rowNum}`).value = loc.address || ''
    worksheet.getCell(`F${rowNum}`).value = loc.detailLocation || ''
    worksheet.getCell(`G${rowNum}`).value = loc.phoneNumber || ''
    worksheet.getCell(`H${rowNum}`).value =
      loc.status === 'draft'
        ? 'Draft'
        : loc.status === 'active'
          ? 'Aktif'
          : 'Nonaktif'
  })

  return workbook.xlsx.writeBuffer()
}

const parseLocationTemplate = async (buffer) => {
  const workbook = new excelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.getWorksheet('Lokasi')
  if (!worksheet) {
    throw new Error('Sheet "Lokasi" tidak ditemukan')
  }

  const headers = []
  worksheet.getRow(1).eachCell((cell) => {
    headers.push(cell.value)
  })

  if (!validateLocationHeaders(headers)) {
    throw new Error(
      'Header template tidak valid. Pastikan menggunakan template yang benar'
    )
  }

  const locations = []
  const startRow = 2

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= startRow) {
      const rowData = row.values
      if (rowData[1] || rowData[3]) {
        locations.push({
          no: rowData[1],
          id: rowData[2] ? String(rowData[2]).trim() : null,
          name: rowData[3] ? String(rowData[3]).trim() : '',
          image: rowData[4] ? String(rowData[4]).trim() : '',
          address: rowData[5] ? String(rowData[5]).trim() : '',
          detailLocation: rowData[6] ? String(rowData[6]).trim() : '',
          phoneNumber: rowData[7] ? String(rowData[7]).trim() : '',
          status: rowData[8] ? String(rowData[8]).trim() : 'Aktif'
        })
      }
    }
  })

  return locations
}

const INVOICE_LOGO_HEADERS = [
  { key: 'no', header: 'No.', width: 8 },
  { key: 'id', header: 'ID', width: 15 },
  { key: 'store', header: 'Store ID', width: 15 },
  { key: 'image', header: 'Gambar (URL)', width: 30 },
  { key: 'isActive', header: 'Aktif', width: 12 },
  { key: 'status', header: 'Status', width: 12 },
  { key: 'createdBy', header: 'Dibuat Oleh', width: 20 }
]

const INVOICE_LOGO_REQUIRED_HEADERS = [
  'No.',
  'ID',
  'Store ID',
  'Gambar (URL)',
  'Aktif',
  'Status',
  'Dibuat Oleh'
]

const validateInvoiceLogoHeaders = (headers) => {
  const headerNames = headers.map((h) => h.toString().trim())
  return INVOICE_LOGO_REQUIRED_HEADERS.every((required) =>
    headerNames.includes(required)
  )
}

const downloadInvoiceLogoTemplate = async (existingLogos = []) => {
  const workbook = new excelJS.Workbook()
  const worksheet = workbook.addWorksheet('Logo')

  worksheet.columns = INVOICE_LOGO_HEADERS.map((h) => ({
    header: h.header,
    key: h.key,
    width: h.width
  }))

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4472C4' }
  }
  headerRow.alignment = { horizontal: 'center' }
  headerRow.height = 25

  const maxRows = Math.max(existingLogos.length + 2, 5)
  for (let row = 2; row <= maxRows; row++) {
    worksheet.getCell(`A${row}`).value = row - 1
    worksheet.getCell(`E${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formula1: ['"Ya,Tidak"'],
      showDropDown: true
    }
    worksheet.getCell(`F${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formula1: ['"Aktif,Nonaktif,Draft"'],
      showDropDown: true
    }
  }

  existingLogos.forEach((logo, index) => {
    const rowNum = index + 2
    worksheet.getCell(`B${rowNum}`).value = logo.id
    worksheet.getCell(`C${rowNum}`).value = logo.store
    worksheet.getCell(`D${rowNum}`).value = logo.image || ''
    worksheet.getCell(`E${rowNum}`).value = logo.isActive ? 'Ya' : 'Tidak'
    worksheet.getCell(`F${rowNum}`).value =
      logo.status === 'draft'
        ? 'Draft'
        : logo.status === 'active'
          ? 'Aktif'
          : 'Nonaktif'
    worksheet.getCell(`G${rowNum}`).value = logo.createdBy || ''
  })

  return workbook.xlsx.writeBuffer()
}

const parseInvoiceLogoTemplate = async (buffer) => {
  const workbook = new excelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.getWorksheet('Logo')
  if (!worksheet) {
    throw new Error('Sheet "Logo" tidak ditemukan')
  }

  const headers = []
  worksheet.getRow(1).eachCell((cell) => {
    headers.push(cell.value)
  })

  if (!validateInvoiceLogoHeaders(headers)) {
    throw new Error(
      'Header template tidak valid. Pastikan menggunakan template yang benar'
    )
  }

  const logos = []
  const startRow = 2

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= startRow) {
      const rowData = row.values
      if (rowData[1] || rowData[3]) {
        logos.push({
          no: rowData[1],
          id: rowData[2] ? String(rowData[2]).trim() : null,
          store: rowData[3] ? String(rowData[3]).trim() : '',
          image: rowData[4] ? String(rowData[4]).trim() : '',
          isActive: rowData[5] ? String(rowData[5]).trim() : 'Tidak',
          status: rowData[6] ? String(rowData[6]).trim() : 'Aktif',
          createdBy: rowData[7] ? String(rowData[7]).trim() : ''
        })
      }
    }
  })

  return logos
}

module.exports = {
  downloadProductTemplate,
  parseProductTemplate,
  downloadLocationTemplate,
  parseLocationTemplate,
  downloadInvoiceLogoTemplate,
  parseInvoiceLogoTemplate,
  TEMPLATE_HEADERS,
  REQUIRED_HEADERS,
  LOCATION_HEADERS,
  LOCATION_REQUIRED_HEADERS,
  INVOICE_LOGO_HEADERS,
  INVOICE_LOGO_REQUIRED_HEADERS,
  UNIT_OPTIONS,
  BASE_UNIT_OPTIONS
}
