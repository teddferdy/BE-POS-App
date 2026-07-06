const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')

// ponytail: Vercel serverless can't run puppeteer/WA.
// Point WHATSAPP_API_URL at a local ngrok'd whatsapp-server.js instance.
const API = process.env.WHATSAPP_API_URL

// ponytail: Vercel serverless can only write to /tmp
const AUTH_DIR = !API && (process.env.VERCEL
  ? '/tmp/.wwebjs_auth'
  : path.join(__dirname, '..', '.wwebjs_auth'))

const CHROME_PATH =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let client = null
let isReady = false
let qrCodeBase64 = null
let initError = null
let initPromise = null
let readyCheckInterval = null

const getChromePath = () => {
  if (fs.existsSync(CHROME_PATH)) return CHROME_PATH
  return undefined
}

const clearReadyCheck = () => {
  if (readyCheckInterval) {
    clearInterval(readyCheckInterval)
    readyCheckInterval = null
  }
}

const initClient = () => {
  if (API) return fetch(`${API}/init`).then(r => r.json()).then(d => d.data?.initialized)
  if (initPromise) return initPromise

  initPromise = new Promise((resolve) => {
    try {
      const chromePath = getChromePath()
      const puppeteerOpts = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ]
      }
      if (chromePath) puppeteerOpts.executablePath = chromePath

      client = new Client({
        authStrategy: new LocalAuth({
          dataPath: AUTH_DIR
        }),
        puppeteer: puppeteerOpts,
        webVersionCache: {
          type: 'remote',
          remotePath:
            'https://raw.githubusercontent.com/wppconnect-teams/wa-version/main/html/2.2412.54.html'
        }
      })

      client.on('qr', async (qr) => {
        try {
          qrCodeBase64 = await QRCode.toDataURL(qr)
        } catch {
          qrCodeBase64 = null
        }
        isReady = false
        console.log('\n=== WHATSAPP QR CODE ===')
        console.log(
          'Scan the QR code with WhatsApp mobile app to enable invoice sending.'
        )
        console.log('QR updated. Open GET /pos/whatsapp/status to view.\n')
      })

      client.on('authenticated', () => {
        console.log('WhatsApp client authenticated')
        isReady = true
        resolve(true)
      })

      client.on('ready', () => {
        isReady = true
        qrCodeBase64 = null
        clearReadyCheck()
        console.log(
          'WhatsApp client is ready! Connected as:',
          client.info?.pushname || client.info?.wid?.user
        )
        resolve(true)
      })

      client.on('disconnected', (reason) => {
        isReady = false
        console.log('WhatsApp client disconnected:', reason)
        if (reason === 'LOGGED_OUT') {
          initPromise = null
        }
        clearReadyCheck()
      })

      client.on('auth_failure', (msg) => {
        initError = msg
        console.error('WhatsApp auth failure:', msg)
        clearReadyCheck()
        resolve(false)
      })

      client.initialize().catch((err) => {
        initError = err.message
        console.error('WhatsApp client init error:', err.message)
        clearReadyCheck()
        resolve(false)
      })

      // Fallback: if client.info becomes available (session restored) but ready/authenticated
      // events never fire, mark as ready after a short delay
      readyCheckInterval = setInterval(() => {
        if (client?.info?.wid?.user) {
          console.log(
            'WhatsApp client info available (session restored), marking ready.'
          )
          isReady = true
          qrCodeBase64 = null
          clearReadyCheck()
          resolve(true)
        }
        if (client?.info?.pushname) {
          console.log('WhatsApp client pushname available, marking ready.')
          isReady = true
          qrCodeBase64 = null
          clearReadyCheck()
          resolve(true)
        }
      }, 2000)

      // Stop checking after 60 seconds to avoid memory leaks
      setTimeout(() => {
        clearReadyCheck()
        if (!isReady && !qrCodeBase64 && !initError) {
          initError = 'WhatsApp initialization timed out after 60s'
          resolve(false)
        }
      }, 60000)
    } catch (err) {
      initError = err.message
      console.error('WhatsApp client creation error:', err.message)
      resolve(false)
    }
  })

  return initPromise
}

const getConnectionStatus = async () => {
  if (API) {
    const r = await fetch(`${API}/status`)
    const d = await r.json()
    return d.data
  }
  return {
    ready: isReady,
    hasQR: !!qrCodeBase64,
    qrBase64: qrCodeBase64,
    error: initError,
    phoneNumber: client?.info?.wid?.user || null,
    pushName: client?.info?.pushname || null
  }
}

const sendDocument = async (phoneNumber, filePath, caption) => {
  if (API) {
    const fileBase64 = fs.readFileSync(filePath).toString('base64')
    const fileName = path.basename(filePath)
    const r = await fetch(`${API}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneNumber, fileBase64, fileName, caption })
    })
    const d = await r.json()
    if (!d.success) throw new Error(d.message)
    return
  }
  if (!client || !isReady) {
    throw new Error('WhatsApp not connected. Scan QR code first.')
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')
  const waNumber = cleanPhone.startsWith('0')
    ? '62' + cleanPhone.slice(1)
    : cleanPhone
  const chatId = `${waNumber}@c.us`

  const media = MessageMedia.fromFilePath(filePath)
  await client.sendMessage(chatId, media, {
    caption: caption,
    sendMediaAsDocument: true
  })
}

const logout = async () => {
  if (API) {
    await fetch(`${API}/logout`, { method: 'POST' })
    return
  }
  clearReadyCheck()
  if (client) {
    try {
      await client.logout()
    } catch {
      // ignore logout errors
    }
  }
  isReady = false
  initPromise = null
  qrCodeBase64 = null
  destroyClient()
}

const destroyClient = () => {
  if (client) {
    try {
      client.destroy()
    } catch {
      // ignore
    }
    client = null
  }
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
  }
}

const restartClient = async () => {
  if (API) {
    const r = await fetch(`${API}/restart`, { method: 'POST' })
    const d = await r.json()
    return d.data?.initialized
  }
  await logout()
  initPromise = initClient()
  return initPromise
}

module.exports = {
  initClient,
  getConnectionStatus,
  sendDocument,
  logout,
  restartClient
}
