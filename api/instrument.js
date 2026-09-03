// Backend error tracking — the frontend has had Sentry wired in for a while
// (see FE-POS-App/src/sentry.react.config.js), but the API had none: errors
// were only ever visible via console.error, so nobody would know checkout
// started failing in production until a user reported it.
//
// No-ops unless SENTRY_DSN is set, so local/dev/CI runs are unaffected.
const Sentry = require('@sentry/node')

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1
  })
  console.log('[sentry] error tracking enabled')
}

module.exports = Sentry
