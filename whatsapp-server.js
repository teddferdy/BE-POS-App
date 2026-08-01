// ponytail: standalone WhatsApp server for local/ngrok usage
// WhatsApp-web.js can't run on Vercel serverless.
// Run locally: node whatsapp-server.js
// Expose: ngrok http 3456
// Set env on Vercel: WHATSAPP_API_URL=https://xxx.ngrok.io

const express = require('express')
const fs = require('fs')
const {
  initClient,
  getConnectionStatus,
  sendDocument,
  restartClient,
  logout
} = require('./utils/whatsappClient')

const app = express()
app.use(express.json({ limit: '50mb' }))

// Lazy-init on first request per store
initClient()

const storeId = (req) => req.query.storeId || 'default'

app.get('/status', async (req, res) => {
  const sid = storeId(req)
  res.json({
    success: true,
    message: 'WhatsApp status',
    data: { ...(await getConnectionStatus(sid)), storeId: sid }
  })
})

app.get('/init', async (req, res) => {
  const sid = storeId(req)
  const result = await initClient(sid)
  res.json({
    success: true,
    message: 'WhatsApp client initialized',
    data: { initialized: !!result, storeId: sid }
  })
})

app.post('/restart', async (req, res) => {
  const sid = storeId(req)
  const result = await restartClient(sid)
  res.json({
    success: true,
    message: 'WhatsApp client restarting',
    data: { initialized: !!result, storeId: sid }
  })
})

app.post('/logout', async (req, res) => {
  const sid = storeId(req)
  await logout(sid)
  res.json({
    success: true,
    message: 'WhatsApp berhasil diputuskan',
    storeId: sid
  })
})

app.post('/send', async (req, res) => {
  try {
    const { phone, fileBase64, fileName, caption } = req.body
    if (!phone || !fileBase64)
      throw new Error('phone and fileBase64 are required')

    const tmpPath = `/tmp/${fileName || 'invoice.pdf'}`
    fs.writeFileSync(tmpPath, Buffer.from(fileBase64, 'base64'))

    await sendDocument(phone, tmpPath, caption || '')
    fs.unlinkSync(tmpPath)

    res.json({ success: true, message: 'Document sent via WhatsApp' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

const PORT = process.env.PORT || 3456
app.listen(PORT, () => {
  console.log(`\nWhatsApp server running on http://localhost:${PORT}`)
  console.log(`Status: http://localhost:${PORT}/status`)
  console.log(`\nTo expose via ngrok:`)
  console.log(`  ngrok http ${PORT}`)
  console.log(`\nThen set on Vercel:`)
  console.log(`  WHATSAPP_API_URL=https://your-ngrok-url.ngrok.io\n`)
})
