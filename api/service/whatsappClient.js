const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')

const whatsappClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox']
  }
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
