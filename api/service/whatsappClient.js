/* eslint-disable no-undef */
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
var fs = require('fs')

const SESSION_FILE_PATH = '../../session.json'
let sessionCfg
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH)
}

const whatsappClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: false },
  session: sessionCfg
})

whatsappClient.on('qr', (qr) => qrcode.generate(qr, { small: true }))
whatsappClient.on('ready', () => console.log('ITS READY'))

whatsappClient.on('message', async (msg) => {
  console.log('JELLO', msg)

  try {
    if (msg.from !== 'status@broadcast') {
      const contact = await msg.getContact()
      console.log('contact', contact)
      console.log('msg', msg.body)
    }
  } catch (error) {
    console.log(error)
  }
})

module.exports = whatsappClient
