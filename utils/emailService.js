'use strict'
const nodemailer = require('nodemailer')

let transporter = null

const getTransporter = () => {
  const host = process.env.SMTP_HOST
  if (!host) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
    })
  }
  return transporter
}

const isEmailConfigured = () => !!process.env.SMTP_HOST

const getFromAddress = () =>
  process.env.SMTP_FROM ||
  `"Bisa Nota" <${process.env.SMTP_USER || 'no-reply@localhost'}>`

/**
 * Send an email via SMTP (nodemailer).
 * Throws a clear error when SMTP_* is not configured.
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter()
  if (!transporter) {
    throw new Error(
      'SMTP belum dikonfigurasi (atur SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)'
    )
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '')
  })
}

/**
 * Build the password reset email content.
 */
function buildResetPasswordEmail({ name, resetUrl, expiresInMinutes = 15 }) {
  const appName = process.env.APP_NAME || 'Bisa Nota'
  const subject = `${appName} — Atur Ulang Kata Sandi`
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
    <h2 style="margin-bottom:8px">Atur Ulang Kata Sandi</h2>
    <p>Halo ${name || 'Pengguna'},</p>
    <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Klik tombol di bawah untuk melanjutkan:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${resetUrl}" style="background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block">Atur Ulang Kata Sandi</a>
    </p>
    <p style="color:#555;font-size:13px">Tautan ini berlaku selama <strong>${expiresInMinutes} menit</strong>. Jika Anda tidak meminta ini, abaikan email ini.</p>
    <p style="color:#888;font-size:12px">— ${appName}</p>
  </div>`

  return {
    subject,
    html,
    text: `Atur Ulang Kata Sandi\n\nHalo ${name || 'Pengguna'},\n\nKlik tautan berikut untuk mengatur ulang kata sandi Anda (berlaku ${expiresInMinutes} menit):\n${resetUrl}\n\nJika Anda tidak meminta ini, abaikan email ini.`
  }
}

module.exports = {
  sendEmail,
  isEmailConfigured,
  buildResetPasswordEmail
}
