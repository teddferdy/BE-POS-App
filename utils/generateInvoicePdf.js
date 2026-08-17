const PDFDocument = require('pdfkit')
const path = require('path')
const fs = require('fs')

const DEFAULT_SETTINGS = {
  showStoreName: true,
  showAddress: true,
  showMemberInfo: true,
  showLogo: true,
  showSocialMedia: true,
  socialMediaVisibility: null,
  addressFieldsVisibility: null,
  memberFieldsVisibility: null,
  logo: null,
  footer: 'Terima kasih atas kunjungan Anda'
}

const generateInvoicePdf = (order, storeData, items, settings = null) => {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) }

  const invoiceDir = process.env.VERCEL
    ? '/tmp/invoices'
    : path.join(__dirname, '..', 'public', 'invoices')
  if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true })

  const fileName = `invoice-${order.orderNumber || order.id}.pdf`
  const filePath = path.join(invoiceDir, fileName)
  const doc = new PDFDocument({ size: [226, 10000], margin: 8 })
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)

  const fmt = (v) => 'Rp' + Number(v || 0).toLocaleString('id-ID')
  const M = doc.page.margins.left
  const PW = doc.page.width - M - doc.page.margins.right

  const center = (text, opts = {}) => {
    doc.font(opts.font || 'Courier')
    if (opts.size) doc.fontSize(opts.size)
    if (opts.color) doc.fillColor(opts.color)
    const tw = doc.widthOfString(text)
    doc.text(text, M + (PW - tw) / 2, doc.y)
  }

  const writeRow = (left, right, opts = {}) => {
    const y = doc.y
    doc.font(opts.bold ? 'Courier-Bold' : 'Courier')
    if (opts.size) doc.fontSize(opts.size)
    if (opts.color) doc.fillColor(opts.color)
    doc.text(left, M, y)
    if (right != null) {
      const rw = doc.widthOfString(right)
      doc.text(right, M + PW - rw, y)
    }
    doc.y = y + (opts.lh || 10)
  }

  const hr = (style = 'solid') => {
    doc.fontSize(5).font('Courier')
    const dashW = doc.widthOfString('-')
    const spaceW = doc.widthOfString(' ')
    const count = Math.floor(PW / dashW)

    let line
    if (style === 'solid') {
      line = '-'.repeat(count)
    } else if (style === 'light') {
      const pairW = dashW + spaceW
      const pairs = Math.floor(PW / pairW)
      line = Array.from({ length: pairs }, () => '- ')
        .join('')
        .trimEnd()
    } else {
      const pairW = dashW + spaceW
      const pairs = Math.floor(PW / pairW)
      line = Array.from({ length: pairs }, () => '- ')
        .join('')
        .trimEnd()
    }

    const color = style === 'light' ? '#F3F4F6' : '#D1D5DB'
    doc.fillColor(color)
    doc.text(line, M, doc.y, { width: PW })
  }

  const mv = s.memberFieldsVisibility
  const smv = s.socialMediaVisibility

  const hasHeader = s.showStoreName || s.showAddress || (s.showLogo && s.logo)

  if (hasHeader) {
    if (s.showLogo && s.logo) {
      try {
        const logoPath = s.logo
        if (logoPath) {
          const logoY = doc.y
          doc.image(logoPath, M, logoY, {
            width: 40,
            height: 40,
            fit: [40, 40]
          })
          doc.y = logoY + 45
        }
      } catch (err) {
        console.error('Failed to load logo for PDF:', err.message)
      }
    }

    if (s.showStoreName) {
      doc.font('Courier-Bold').fontSize(10).fillColor('#1F2937')
      center((storeData?.name || 'TOKO').toUpperCase(), {
        size: 10,
        font: 'Courier-Bold',
        color: '#1F2937'
      })
      doc.moveDown(0.15)
    }

    if (s.showAddress) {
      doc.font('Courier').fontSize(6.5).fillColor('#6B7280')
      if (storeData?.address)
        center(storeData.address, {
          size: 6.5,
          font: 'Courier',
          color: '#6B7280'
        })
      if (storeData?.phoneNumber)
        center('Telp: ' + storeData.phoneNumber, {
          size: 6.5,
          font: 'Courier',
          color: '#6B7280'
        })
      if (storeData?.email)
        center(storeData.email, {
          size: 6.5,
          font: 'Courier',
          color: '#6B7280'
        })
      doc.moveDown(0.2)
    }

    hr('solid')
    doc.moveDown(0.15)
  }

  const d = new Date(order.createdAt)
  const dateStr = d.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const timeStr = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  })
  const invNum = order.orderNumber || order.id || '-'
  const cashier = order.cashierName || '-'

  writeRow(dateStr, timeStr, { size: 6.5, color: '#6B7280', lh: 9 })
  writeRow('Invoice: ' + invNum, 'Kasir: ' + cashier, {
    size: 6.5,
    color: '#6B7280',
    lh: 9
  })
  doc.moveDown(0.1)

  hr('dashed')
  doc.moveDown(0.1)

  if (s.showMemberInfo && order.customerName) {
    const showName = mv?.name !== false
    const showTier = mv?.tier !== false
    const showPoints = mv?.points !== false

    if (showName) {
      doc.font('Courier-Bold').fontSize(6.5).fillColor('#374151')
      writeRow(order.customerName, '', {
        size: 6.5,
        color: '#374151',
        bold: true,
        lh: 10
      })
    }
    if (showTier && order.customerTier)
      writeRow('  Tier: ' + order.customerTier, '', {
        size: 6,
        color: '#6B7280',
        lh: 8
      })
    if (showPoints && order.customerPoints)
      writeRow(
        '  Poin: ' + Number(order.customerPoints).toLocaleString('id-ID'),
        '',
        { size: 6, color: '#6B7280', lh: 8 }
      )
    doc.moveDown(0.1)
    hr('dashed')
    doc.moveDown(0.1)
  }

  const colItem = M
  const colQty = M + PW * 0.42
  const colPrice = M + PW * 0.58
  const colTotal = M + PW * 0.78

  doc.font('Courier-Bold').fontSize(6.5).fillColor('#4B5563')
  const yHead = doc.y
  doc.text('Item', colItem, yHead)
  doc.text('Qty', colQty, yHead, { width: 18, align: 'center' })
  doc.text('Harga', colPrice, yHead, { width: PW * 0.2, align: 'right' })
  doc.text('Total', colTotal, yHead, { width: PW * 0.22, align: 'right' })
  doc.y = yHead + 9
  doc.moveDown(0.1)

  hr('solid')
  doc.moveDown(0.05)

  for (const item of items || []) {
    const name = item.productName || item.name || 'Item'
    const qty = item.quantity || item.qty || 0
    const price = item.price || 0
    const total = item.totalPrice || item.total || item.subtotal || qty * price
    const yStart = doc.y

    doc.font('Courier').fontSize(6.5).fillColor('#374151')
    doc.text(name, colItem, yStart, { width: colQty - colItem - 2 })

    doc.fillColor('#4B5563')
    doc.text(String(qty), colQty, yStart, { width: 18, align: 'center' })
    doc.text(fmt(price), colPrice, yStart, { width: PW * 0.2, align: 'right' })

    doc.fillColor('#374151')
    doc.text(fmt(total), colTotal, yStart, { width: PW * 0.22, align: 'right' })

    doc.y = yStart + 9
    hr('light')
  }

  doc.moveDown(0.1)

  const subtotal =
    order.subTotal ||
    items.reduce(
      (sum, i) => sum + Number(i.totalPrice || i.price * i.quantity || 0),
      0
    )
  const tax = order.taxAmount || Math.round(subtotal * 0.1)
  const discount = order.discountAmount || 0
  const serviceCharge = order.serviceChargeAmount || 0

  hr('solid')
  doc.moveDown(0.1)

  writeRow('Subtotal', fmt(subtotal), { size: 7, color: '#374151', lh: 11 })
  if (discount > 0)
    writeRow('Diskon', '-' + fmt(discount), {
      size: 7,
      color: '#374151',
      lh: 11
    })
  if (serviceCharge > 0)
    writeRow('Biaya Layanan', fmt(serviceCharge), {
      size: 7,
      color: '#374151',
      lh: 11
    })
  writeRow('Pajak (10%)', fmt(tax), { size: 7, color: '#374151', lh: 11 })

  doc.moveDown(0.1)
  doc.fontSize(4).fillColor('#D1D5DB').font('Courier')
  const dashW2 = doc.widthOfString('-')
  const count2 = Math.floor(PW / dashW2)
  doc.text('-'.repeat(count2), M, doc.y, { width: PW })
  doc.moveDown(0.1)

  doc.font('Courier-Bold').fontSize(9).fillColor('#111827')
  writeRow('TOTAL', fmt(order.totalPrice || 0), {
    size: 9,
    color: '#111827',
    bold: true,
    lh: 14
  })

  doc.moveDown(0.2)

  doc.font('Courier').fontSize(6.5).fillColor('#6B7280')
  writeRow('Pembayaran: ' + (order.paymentMethod || '-'), '', {
    size: 6.5,
    color: '#6B7280',
    lh: 9
  })

  if (order.paymentMethod === 'Tunai') {
    const cashAmount = order.cashAmount || 0
    const changeAmount = order.changeAmount || 0
    if (cashAmount > 0)
      writeRow('Tunai', fmt(cashAmount), { size: 6.5, color: '#6B7280', lh: 9 })
    if (changeAmount > 0)
      writeRow('Kembali', fmt(changeAmount), {
        size: 6.5,
        color: '#6B7280',
        lh: 9
      })
  }

  if (order.paymentStatus === 'paid') {
    writeRow('Status: LUNAS', '', { size: 6.5, color: '#6B7280', lh: 9 })
  }

  doc.moveDown(0.2)
  hr('dashed')
  doc.moveDown(0.15)

  const footerText = s.footer || 'Terima kasih atas kunjungan Anda'
  doc.font('Courier-Oblique').fontSize(6.5).fillColor('#9CA3AF')
  center(footerText, {
    size: 6.5,
    font: 'Courier-Oblique',
    color: '#9CA3AF'
  })

  if (s.showSocialMedia && storeData?.socialMedia?.length) {
    const socialMedia = storeData.socialMedia
    const visibleSocials = socialMedia.filter((_, i) => {
      if (!smv) return true
      return smv[i] !== false
    })

    if (visibleSocials.length > 0) {
      doc.moveDown(0.1)
      doc.fontSize(4).fillColor('#D1D5DB').font('Courier')
      doc.text('-'.repeat(count2), M, doc.y, { width: PW })
      doc.moveDown(0.1)

      doc.font('Courier').fontSize(5.5).fillColor('#9CA3AF')
      const smLines = visibleSocials
        .map((sm) => `${sm.platform}: ${sm.account}`)
        .join('  |  ')
      center(smLines, { size: 5.5, font: 'Courier', color: '#9CA3AF' })
    }
  }

  doc.end()

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ fileName, filePath }))
    stream.on('error', reject)
  })
}

module.exports = { generateInvoicePdf }
