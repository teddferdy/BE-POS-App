const excelJS = require('exceljs')

const TEMPLATE_HEADERS = [
  { key: 'no', header: 'No.', width: 8 },
  { key: 'id', header: 'ID', width: 15 },
  { key: 'nameProduct', header: 'Nama Produk', width: 25 },
  { key: 'image', header: 'Gambar (URL)', width: 30 },
  { key: 'description', header: 'Deskripsi', width: 30 },
  { key: 'category', header: 'Kategori', width: 20 },
  { key: 'price', header: 'Harga', width: 15 },
  { key: 'status', header: 'Status', width: 10 },
  { key: 'isOption', header: 'Opsi', width: 10 },
  { key: 'option', header: 'Daftar Opsi', width: 25 },
  { key: 'stock', header: 'Stok', width: 12 },
  { key: 'costPrice', header: 'Harga Beli', width: 15 },
  { key: 'minStock', header: 'Min Stok', width: 12 },
  { key: 'unit', header: 'Satuan', width: 10 }
]

const REQUIRED_HEADERS = [
  'No.',
  'ID',
  'Nama Produk',
  'Gambar (URL)',
  'Deskripsi',
  'Kategori',
  'Harga',
  'Status',
  'Opsi',
  'Daftar Opsi'
]

const validateTemplateHeaders = (headers) => {
  const headerNames = headers.map((h) => h.toString().trim())
  return REQUIRED_HEADERS.every((required) => headerNames.includes(required))
}

const downloadProductTemplate = async (categories, existingProducts = []) => {
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

  const categoryList = categories.map((c) => c.name).join(',')
  worksheet.getCell('F2').dataValidation = {
    type: 'list',
    allowBlank: true,
    formula1: [`"${categoryList}"`],
    showDropDown: true
  }

  worksheet.getCell('H2').dataValidation = {
    type: 'list',
    allowBlank: true,
    formula1: ['"Aktif,Nonaktif"'],
    showDropDown: true
  }

  worksheet.getCell('I2').dataValidation = {
    type: 'list',
    allowBlank: true,
    formula1: ['"Ya,Tidak"'],
    showDropDown: true
  }

  const maxRows = Math.max(existingProducts.length + 2, 12)
  for (let row = 2; row <= maxRows; row++) {
    worksheet.getCell(`A${row}`).value = row - 1
    worksheet.getCell(`H${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formula1: ['"Aktif,Nonaktif"'],
      showDropDown: true
    }
    worksheet.getCell(`I${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formula1: ['"Ya,Tidak"'],
      showDropDown: true
    }
    worksheet.getCell(`F${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formula1: [`"${categoryList}"`],
      showDropDown: true
    }
  }

  existingProducts.forEach((prod, index) => {
    const rowNum = index + 2
    worksheet.getCell(`B${rowNum}`).value = prod.id
    worksheet.getCell(`C${rowNum}`).value = prod.nameProduct
    worksheet.getCell(`D${rowNum}`).value = prod.image || ''
    worksheet.getCell(`E${rowNum}`).value = prod.description || ''
    worksheet.getCell(`F${rowNum}`).value = prod.categoryName || ''
    worksheet.getCell(`G${rowNum}`).value = prod.price || 0
    worksheet.getCell(`H${rowNum}`).value = prod.status === 'active' ? 'Aktif' : 'Nonaktif'
    worksheet.getCell(`I${rowNum}`).value = prod.isOption ? 'Ya' : 'Tidak'
    worksheet.getCell(`J${rowNum}`).value = prod.options
      ? (Array.isArray(prod.options) ? prod.options.join(',') : prod.options)
      : ''
    worksheet.getCell(`K${rowNum}`).value = prod.stock || 0
    worksheet.getCell(`L${rowNum}`).value = prod.costPrice || 0
    worksheet.getCell(`M${rowNum}`).value = prod.minStock || 0
    worksheet.getCell(`N${rowNum}`).value = prod.unit || 'pcs'
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
    headers.push(cell.value)
  })

  if (!validateTemplateHeaders(headers)) {
    throw new Error(
      'Header template tidak valid. Pastikan menggunakan template yang benar'
    )
  }

  const products = []
  const startRow = 2

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= startRow) {
      const rowData = row.values
      if (rowData[1] || rowData[3]) {
        products.push({
          no: rowData[1],
          id: rowData[2] ? String(rowData[2]).trim() : null,
          nameProduct: rowData[3] ? String(rowData[3]).trim() : '',
          image: rowData[4] ? String(rowData[4]).trim() : '',
          description: rowData[5] ? String(rowData[5]).trim() : '',
          category: rowData[6] ? String(rowData[6]).trim() : '',
          price: rowData[7] ? parseFloat(rowData[7]) : 0,
          status: rowData[8] ? String(rowData[8]).trim() : 'Aktif',
          isOption: rowData[9] ? String(rowData[9]).trim() : 'Tidak',
          options: rowData[10]
            ? String(rowData[10]).split(',').map(s => s.trim()).filter(Boolean)
            : [],
          stock: rowData[11] ? parseFloat(rowData[11]) : 0,
          costPrice: rowData[12] ? parseFloat(rowData[12]) : 0,
          minStock: rowData[13] ? parseFloat(rowData[13]) : 0,
          unit: rowData[14] ? String(rowData[14]).trim() : 'pcs'
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
      formula1: ['"Aktif,Nonaktif"'],
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
    worksheet.getCell(`H${rowNum}`).value = loc.status === 'active' ? 'Aktif' : 'Nonaktif'
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
      formula1: ['"Aktif,Nonaktif"'],
      showDropDown: true
    }
  }

  existingLogos.forEach((logo, index) => {
    const rowNum = index + 2
    worksheet.getCell(`B${rowNum}`).value = logo.id
    worksheet.getCell(`C${rowNum}`).value = logo.store
    worksheet.getCell(`D${rowNum}`).value = logo.image || ''
    worksheet.getCell(`E${rowNum}`).value = logo.isActive ? 'Ya' : 'Tidak'
    worksheet.getCell(`F${rowNum}`).value = logo.status === 'active' ? 'Aktif' : 'Nonaktif'
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
  INVOICE_LOGO_REQUIRED_HEADERS
}
