const fs = require('fs')
const path = require('path')

const FONNTE_TOKEN = process.env.FONNTE_TOKEN
const FONNTE_URL = 'https://api.fonnte.com/send'

const setSocketIO = () => {}

const getConnectionStatus = async (storeId = 'default') => ({
  ready: !!FONNTE_TOKEN,
  hasQR: false,
  qrBase64: null,
  error: FONNTE_TOKEN ? null : 'FONNTE_TOKEN not set — daftar di https://fonnte.com',
  phoneNumber: null,
  pushName: null,
  storeId
})

const initClient = async () => true
const logout = async () => {}
const restartClient = async () => true

const sendDocument = async (phoneNumber, filePath, caption, storeId = 'default') => {
  if (!FONNTE_TOKEN) throw new Error('FONNTE_TOKEN not configured')

  const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '')

  const form = new FormData()
  form.append('target', cleanPhone)
  form.append('message', caption || '')
  form.append('countryCode', '62')
  form.append('filename', path.basename(filePath || 'invoice.pdf'))

  if (filePath && fs.existsSync(filePath)) {
    const buf = fs.readFileSync(filePath)
    form.append('file', new Blob([buf], { type: 'application/pdf' }), path.basename(filePath))
  }

  const res = await fetch(FONNTE_URL, {
    method: 'POST',
    headers: { Authorization: FONNTE_TOKEN },
    body: form
  })

  const result = await res.json()
  if (!result.status) throw new Error(result.reason || 'Fonnte send failed')
}

module.exports = {
  setSocketIO,
  initClient,
  getConnectionStatus,
  sendDocument,
  logout,
  restartClient
}
