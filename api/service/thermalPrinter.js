const { exec } = require('child_process')
const { promisify } = require('util')
const fs = require('fs')
const path = require('path')
const os = require('os')

const execAsync = promisify(exec)

// ESC/POS Commands
const ESC_POS = {
  // Initialize
  INIT: Buffer.from([0x1b, 0x40]),

  // Text formatting
  BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]),
  UNDERLINE_ON: Buffer.from([0x1b, 0x2d, 0x01]),
  UNDERLINE_OFF: Buffer.from([0x1b, 0x2d, 0x00]),

  // Alignment
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]),

  // Font size
  FONT_NORMAL: Buffer.from([0x1b, 0x21, 0x00]),
  FONT_DOUBLE_HEIGHT: Buffer.from([0x1b, 0x21, 0x10]),
  FONT_DOUBLE_WIDTH: Buffer.from([0x1b, 0x21, 0x20]),
  FONT_DOUBLE_SIZE: Buffer.from([0x1b, 0x21, 0x30]),

  // Paper feed
  FEED_LINE: Buffer.from([0x0a]),
  FEED_LINES: (n) => Buffer.from([0x1b, 0x64, n]),
  FEED_TO_CUT: Buffer.from([0x1b, 0x64, 0x05]),

  // Cut paper
  CUT_PARTIAL: Buffer.from([0x1d, 0x56, 0x41, 0x00]),
  CUT_FULL: Buffer.from([0x1d, 0x56, 0x41, 0x01]),

  // Barcode
  BARCODE_CODE128: Buffer.from([0x1d, 0x6b, 0x49]),
  BARCODE_EAN13: Buffer.from([0x1d, 0x6b, 0x02]),

  // QR Code
  QR_MODEL_1: Buffer.from([
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x31, 0x00
  ]),
  QR_MODEL_2: Buffer.from([
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00
  ]),
  QR_SIZE: (size) =>
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]),
  QR_ERROR_CORRECTION: (level) =>
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, level]),
  QR_STORE_DATA: (data) => {
    const dataBuf = Buffer.from(data)
    const len = dataBuf.length + 3
    return Buffer.concat([
      Buffer.from([
        0x1d,
        0x28,
        0x6b,
        len & 0xff,
        (len >> 8) & 0xff,
        0x31,
        0x50,
        0x30
      ]),
      dataBuf
    ])
  },
  QR_PRINT: Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),

  // Code page
  CODEPAGE_UTF8: Buffer.from([0x1b, 0x74, 0x18]),

  // Beep
  BEEP: Buffer.from([0x1b, 0x42, 0x05, 0x05])
}

class ThermalPrinter {
  constructor(options = {}) {
    this.printerType = options.type || 'auto' // 'usb', 'serial', 'network', 'bluetooth', 'file', 'auto'
    this.devicePath = options.devicePath || '/dev/usb/lp0'
    this.ipAddress = options.ipAddress
    this.port = options.port || 9100
    this.macAddress = options.macAddress
    this.encoding = options.encoding || 'utf8'
    this.columns = options.columns || 32 // 58mm = 32 chars, 80mm = 48 chars
    this.isConnected = false
    this.socket = null
  }

  // Generate receipt data
  generateReceipt(data) {
    const {
      storeName,
      storeAddress,
      storePhone,
      invoiceNo,
      date,
      cashier,
      items,
      subtotal,
      discount = 0,
      tax = 0,
      total,
      paymentMethod,
      amountPaid,
      change = 0,
      customerName,
      customerPhone,
      notes,
      qrCodeData,
      footerText = 'Terima kasih telah berbelanja!'
    } = data

    const buffers = []

    // Initialize
    buffers.push(ESC_POS.INIT)
    buffers.push(ESC_POS.CODEPAGE_UTF8)
    buffers.push(ESC_POS.ALIGN_CENTER)

    // Store header
    buffers.push(ESC_POS.FONT_DOUBLE_SIZE)
    buffers.push(Buffer.from(storeName + '\n'))
    buffers.push(ESC_POS.FONT_NORMAL)
    buffers.push(Buffer.from(storeAddress + '\n'))
    if (storePhone) buffers.push(Buffer.from(storePhone + '\n'))
    buffers.push(Buffer.from('='.repeat(this.columns) + '\n'))

    // Invoice info
    buffers.push(ESC_POS.ALIGN_LEFT)
    buffers.push(Buffer.from(`No: ${invoiceNo}\n`))
    buffers.push(Buffer.from(`Tgl: ${date}\n`))
    buffers.push(Buffer.from(`Kasir: ${cashier}\n`))
    if (customerName) buffers.push(Buffer.from(`Pelanggan: ${customerName}\n`))
    if (customerPhone) buffers.push(Buffer.from(`Telp: ${customerPhone}\n`))
    buffers.push(Buffer.from('-'.repeat(this.columns) + '\n'))

    // Items header
    buffers.push(
      Buffer.from(this.formatLine('Item', 'Qty', 'Harga', 'Total') + '\n')
    )
    buffers.push(Buffer.from('-'.repeat(this.columns) + '\n'))

    // Items
    for (const item of items) {
      const name = this.truncate(
        item.name || item.nameProduct || 'Item',
        this.columns - 10
      )
      const qty = item.qty || item.quantity || 1
      const price = this.formatNumber(item.price || item.sellingPrice || 0)
      const total = this.formatNumber(
        (item.price || item.sellingPrice || 0) * qty
      )

      buffers.push(Buffer.from(`${name}\n`))
      buffers.push(
        Buffer.from(this.formatLine('', `${qty}x`, price, total) + '\n')
      )

      if (item.variantName) {
        buffers.push(Buffer.from(`  ${item.variantName}\n`))
      }
      if (item.notes) {
        buffers.push(Buffer.from(`  Catatan: ${item.notes}\n`))
      }
    }

    buffers.push(Buffer.from('-'.repeat(this.columns) + '\n'))

    // Totals
    buffers.push(this.formatTotalLine('Subtotal', subtotal))
    if (discount > 0) buffers.push(this.formatTotalLine('Diskon', -discount))
    if (tax > 0) buffers.push(this.formatTotalLine('Pajak', tax))
    buffers.push(Buffer.from('='.repeat(this.columns) + '\n'))
    buffers.push(ESC_POS.FONT_DOUBLE_HEIGHT)
    buffers.push(this.formatTotalLine('TOTAL', total, true))
    buffers.push(ESC_POS.FONT_NORMAL)
    buffers.push(Buffer.from('\n'))

    // Payment
    buffers.push(this.formatTotalLine(paymentMethod, amountPaid))
    if (change > 0) buffers.push(this.formatTotalLine('Kembalian', change))
    buffers.push(Buffer.from('\n'))

    // QR Code if provided
    if (qrCodeData) {
      buffers.push(ESC_POS.ALIGN_CENTER)
      buffers.push(Buffer.from('SCAN UNTUK STRUK DIGITAL\n'))
      buffers.push(this.generateQRCode(qrCodeData))
      buffers.push(Buffer.from('\n'))
    }

    // Footer
    buffers.push(ESC_POS.ALIGN_CENTER)
    buffers.push(Buffer.from(footerText + '\n'))
    buffers.push(Buffer.from('\n'))

    // Cut paper
    buffers.push(ESC_POS.FEED_TO_CUT)
    buffers.push(ESC_POS.CUT_PARTIAL)

    return Buffer.concat(buffers)
  }

  formatLine(...parts) {
    const totalWidth = this.columns
    const lastPart = parts.pop()
    const firstParts = parts.join(' ')
    const remaining = totalWidth - lastPart.length
    const padded = firstParts.padEnd(remaining, ' ')
    return padded + lastPart
  }

  formatTotalLine(label, amount, isBold = false) {
    const formatted = this.formatNumber(amount)
    const labelPart = label.padEnd(this.columns - formatted.length - 1)
    const prefix = isBold ? '\x1bE\x01' : ''
    const suffix = isBold ? '\x1bE\x00' : ''
    return `${prefix}${labelPart} ${formatted}${suffix}\n`
  }

  formatNumber(num) {
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(
      Math.abs(num)
    )
  }

  truncate(str, maxLen) {
    if (str.length <= maxLen) return str
    return str.substring(0, maxLen - 3) + '...'
  }

  generateQRCode(data) {
    const buffers = []
    buffers.push(ESC_POS.QR_MODEL_2)
    buffers.push(ESC_POS.QR_SIZE(4)) // Size 1-8
    buffers.push(ESC_POS.QR_ERROR_CORRECTION(0x31)) // Level L
    buffers.push(ESC_POS.QR_STORE_DATA(data))
    buffers.push(ESC_POS.QR_PRINT)
    return Buffer.concat(buffers)
  }

  // Connect to printer
  async connect() {
    switch (this.printerType) {
      case 'usb':
        return this.connectUSB()
      case 'serial':
        return this.connectSerial()
      case 'network':
        return this.connectNetwork()
      case 'bluetooth':
        return this.connectBluetooth()
      case 'file':
        this.isConnected = true
        return true
      case 'auto':
      default:
        return this.autoConnect()
    }
  }

  async connectUSB() {
    // Check if device exists
    try {
      await fs.promises.access(this.devicePath)
      this.isConnected = true
      return true
    } catch {
      throw new Error(`USB printer not found at ${this.devicePath}`)
    }
  }

  async connectSerial() {
    // Would use serialport package
    throw new Error(
      'Serial connection not implemented - install serialport package'
    )
  }

  async connectNetwork() {
    if (!this.ipAddress)
      throw new Error('IP address required for network printer')
    const net = require('net')
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket()
      this.socket.connect(this.port, this.ipAddress, () => {
        this.isConnected = true
        resolve(true)
      })
      this.socket.on('error', reject)
      this.socket.setTimeout(5000, () =>
        reject(new Error('Connection timeout'))
      )
    })
  }

  async connectBluetooth() {
    if (os.platform() === 'darwin') {
      // Use macOS Bluetooth script
      this.isConnected = true
      return true
    }
    throw new Error(
      'Bluetooth printing only supported on macOS via thermal-bt.py'
    )
  }

  async autoConnect() {
    // Try network first (most common for POS)
    if (this.ipAddress) {
      try {
        await this.connectNetwork()
        this.printerType = 'network'
        return true
      } catch {}
    }

    // Try USB
    const usbPaths = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0', '/dev/lp1']
    for (const p of usbPaths) {
      try {
        await fs.promises.access(p)
        this.devicePath = p
        this.printerType = 'usb'
        this.isConnected = true
        return true
      } catch {}
    }

    // Fallback to file (for testing)
    this.printerType = 'file'
    this.isConnected = true
    return true
  }

  async print(data) {
    if (!this.isConnected) {
      await this.connect()
    }

    const receiptData =
      typeof data === 'object' ? this.generateReceipt(data) : data

    switch (this.printerType) {
      case 'usb':
        return this.printUSB(receiptData)
      case 'network':
        return this.printNetwork(receiptData)
      case 'bluetooth':
        return this.printBluetooth(receiptData)
      case 'file':
        return this.printToFile(receiptData)
      default:
        throw new Error(`Unknown printer type: ${this.printerType}`)
    }
  }

  async printUSB(data) {
    try {
      await fs.promises.writeFile(this.devicePath, data)
      return { success: true, message: 'Printed to USB' }
    } catch (error) {
      throw new Error(`USB print failed: ${error.message}`)
    }
  }

  async printNetwork(data) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error('Not connected to network printer'))
        return
      }
      this.socket.write(data, (err) => {
        if (err) reject(new Error(`Network print failed: ${err.message}`))
        else resolve({ success: true, message: 'Printed to network' })
      })
    })
  }

  async printBluetooth(data) {
    if (os.platform() !== 'darwin') {
      throw new Error('Bluetooth printing only on macOS')
    }
    const scriptPath = path.join(__dirname, '..', 'thermal-bt.py')
    const mac =
      this.macAddress || process.env.BT_PRINTER_MAC || '86:67:7A:E4:30:C7'

    return new Promise((resolve, reject) => {
      const child = exec(`cat | python3 "${scriptPath}"`, {
        env: { ...process.env, BT_PRINTER_MAC: mac }
      })

      child.stdin.write(data)
      child.stdin.end()

      let stdout = '',
        stderr = ''
      child.stdout.on('data', (d) => (stdout += d))
      child.stderr.on('data', (d) => (stderr += d))

      child.on('close', (code) => {
        if (code === 0) resolve({ success: true, message: stdout.trim() })
        else reject(new Error(`Bluetooth print failed: ${stderr || stdout}`))
      })
    })
  }

  async printToFile(data) {
    const filePath = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`)
    await fs.promises.writeFile(filePath, data)
    return { success: true, message: `Saved to ${filePath}`, filePath }
  }

  async disconnect() {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this.isConnected = false
  }
}

module.exports = { ThermalPrinter, ESC_POS }
