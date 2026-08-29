const FONNTE_TOKENS = [
  process.env.FONNTE_TOKEN,
  process.env.FONNTE_TOKEN_2
].filter(Boolean)
const FONNTE_URL = 'https://api.fonnte.com/send'

const setSocketIO = () => {}

const getConnectionStatus = async (storeId = 'default') => ({
  ready: FONNTE_TOKENS.length > 0,
  hasQR: false,
  qrBase64: null,
  error:
    FONNTE_TOKENS.length > 0
      ? null
      : 'FONNTE_TOKEN not set — daftar di https://fonnte.com',
  phoneNumber: null,
  pushName: null,
  storeId
})

const initClient = async () => true
const logout = async () => {}
const restartClient = async () => true

const sendDocument = async (
  phoneNumber,
  filePath,
  caption,
  _storeId = 'default'
) => {
  if (FONNTE_TOKENS.length === 0) throw new Error('FONNTE_TOKEN not configured')

  const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '')
  let lastErr = ''

  for (const token of FONNTE_TOKENS) {
    const form = new FormData()
    form.append('target', cleanPhone)
    form.append('message', caption || '')
    form.append('countryCode', '62')

    // ponytail: free Fonnte doesn't support file attachment, text-only
    // caption already has full invoice info

    const res = await fetch(FONNTE_URL, {
      method: 'POST',
      headers: { Authorization: token },
      body: form
    })

    const result = await res.json()
    if (result.status) return
    lastErr = result.reason || JSON.stringify(result)
  }

  throw new Error('Fonnte: ' + lastErr)
}

// Kirim pesan teks WhatsApp lewat Fonnte. Best-effort: throw jika belum dikonfigurasi
// agar pemanggil bisa menangkap tanpa merusak alur utama.
const sendWhatsAppText = async (phoneNumber, message, _storeId = 'default') => {
  if (!phoneNumber || !String(phoneNumber).trim()) return null
  if (FONNTE_TOKENS.length === 0) throw new Error('FONNTE_TOKEN not configured')

  const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '')
  if (!cleanPhone) return null

  let lastErr = ''
  for (const token of FONNTE_TOKENS) {
    const form = new FormData()
    form.append('target', cleanPhone)
    form.append('message', String(message || ''))
    form.append('countryCode', '62')

    const res = await fetch(FONNTE_URL, {
      method: 'POST',
      headers: { Authorization: token },
      body: form
    })

    const result = await res.json()
    if (result.status) return true
    lastErr = result.reason || JSON.stringify(result)
  }

  throw new Error('Fonnte: ' + lastErr)
}

module.exports = {
  setSocketIO,
  initClient,
  getConnectionStatus,
  sendDocument,
  sendWhatsAppText,
  logout,
  restartClient
}
