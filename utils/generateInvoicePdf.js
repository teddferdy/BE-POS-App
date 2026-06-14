const PDFDocument = require('pdfkit')
const path = require('path')
const fs = require('fs')

const generateInvoicePdf = (order, storeData, items) => {
  const invoiceDir = path.join(__dirname, '..', 'public', 'invoices')
  if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true })

  const fileName = `invoice-${order.orderNumber || order.id}.pdf`
  const filePath = path.join(invoiceDir, fileName)
  const doc = new PDFDocument({ size: [226, 'auto'], margin: 10 })
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)

  const formatPrice = (v) => 'Rp ' + Number(v || 0).toLocaleString('id-ID')
  const center = (text, y, opts = {}) => {
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
    doc.fontSize(opts.fontSize || 9).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    const textWidth = doc.widthOfString(text)
    doc.text(text, (width - textWidth) / 2 + doc.page.margins.left, y || doc.y, { align: 'center' })
  }

  // Header
  doc.fontSize(12).font('Helvetica-Bold')
  center(storeData?.name || 'TOKO', doc.y, { bold: true, fontSize: 12 })
  doc.moveDown(0.3)

  doc.fontSize(7).font('Helvetica')
  if (storeData?.address) center(storeData.address, doc.y, { fontSize: 7 })
  if (storeData?.phoneNumber) center('Telp: ' + storeData.phoneNumber, doc.y, { fontSize: 7 })
  doc.moveDown(0.3)

  // Separator
  doc.fontSize(8).font('Helvetica')
  const line = (y) => {
    const left = doc.page.margins.left
    const w = doc.page.width - left - doc.page.margins.right
    doc.moveTo(left, y || doc.y).lineTo(left + w, y || doc.y).stroke()
    doc.moveDown(0.3)
  }
  line()
  doc.moveDown(0.2)

  // Invoice info
  const date = new Date(order.createdAt).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  const leftMargin = doc.page.margins.left
  doc.fontSize(8).font('Helvetica')
  doc.text(`Invoice  : ${order.orderNumber || order.id}`, leftMargin, doc.y, { continued: false })
  doc.text(`Tanggal  : ${date}`, leftMargin, doc.y, { continued: false })
  doc.text(`Kasir    : ${order.cashierName || '-'}`, leftMargin, doc.y, { continued: false })
  if (order.customerName) doc.text(`Pelanggan: ${order.customerName}`, leftMargin, doc.y)
  if (order.table?.name) doc.text(`Meja     : ${order.table.name}`, leftMargin, doc.y)
  doc.moveDown(0.2)
  line()
  doc.moveDown(0.2)

  // Column headers
  doc.fontSize(7).font('Helvetica-Bold')
  const col1 = leftMargin
  const col2 = doc.page.width - doc.page.margins.right - 100
  const col3 = doc.page.width - doc.page.margins.right - 50
  const col4 = doc.page.width - doc.page.margins.right
  doc.text('Item', col1, doc.y, { width: col2 - col1 })
  doc.text('Qty', col2, doc.y, { width: 30, align: 'center' })
  doc.text('Harga', col3 - 10, doc.y, { width: 50, align: 'right' })
  doc.text('Total', col4 - 50, doc.y, { width: 50, align: 'right' })
  doc.moveDown(0.2)

  doc.fontSize(7).font('Helvetica')
  line()
  doc.moveDown(0.1)

  // Items
  for (const item of items || []) {
    doc.fontSize(7).font('Helvetica')
    const name = item.productName || 'Item'
    const yStart = doc.y
    doc.text(name, leftMargin, yStart, { width: col2 - leftMargin })
    doc.text(String(item.quantity || 0), col2, yStart, { width: 30, align: 'center' })
    doc.text(formatPrice(item.price || 0), col3 - 10, yStart, { width: 50, align: 'right' })
    doc.text(formatPrice(item.totalPrice || 0), col4 - 50, yStart, { width: 50, align: 'right' })
    doc.y = yStart + 12
    doc.moveDown(0.1)
  }

  // Totals
  doc.moveDown(0.2)
  line()
  doc.moveDown(0.2)

  const totalWidth = col4 - leftMargin
  const labelX = leftMargin
  const valueX = col4 - 50

  doc.fontSize(8).font('Helvetica')
  const writeRow = (label, value, bold) => {
    const yPos = doc.y
    doc.text(label, labelX, yPos, { width: totalWidth - 50 })
    doc.text(value, valueX, yPos, { width: 50, align: 'right' })
    doc.y = yPos + 12
    doc.moveDown(0.1)
  }
  writeRow('Subtotal', formatPrice(order.subTotal || 0))

  if (order.discountAmount > 0) {
    writeRow('Diskon', '-' + formatPrice(order.discountAmount))
  }

  if (order.serviceChargeAmount > 0) {
    writeRow('Biaya Layanan', formatPrice(order.serviceChargeAmount))
  }

  if (order.taxAmount > 0) {
    writeRow('Pajak', formatPrice(order.taxAmount))
  }

  doc.fontSize(10).font('Helvetica-Bold')
  writeRow('TOTAL', formatPrice(order.totalPrice || 0))
  doc.moveDown(0.5)

  doc.fontSize(7).font('Helvetica')
  doc.text(`Pembayaran: ${order.paymentMethod || '-'}`, leftMargin, doc.y)
  doc.text(`Status: ${order.paymentStatus === 'paid' ? 'LUNAS' : order.paymentStatus}`, leftMargin, doc.y)

  doc.moveDown(0.5)
  line()
  doc.moveDown(0.3)

  center('Terima kasih telah berbelanja!', doc.y, { fontSize: 8 })

  doc.end()

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ fileName, filePath }))
    stream.on('error', reject)
  })
}

module.exports = { generateInvoicePdf }
