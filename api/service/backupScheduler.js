'use strict'
const backupController = require('../controller/backup')

let timer = null
let lastCheck = null

const startBackupScheduler = (intervalMs = 60000) => {
  if (timer) return
  timer = setInterval(async () => {
    try {
      const now = new Date()
      if (lastCheck && now.getTime() - lastCheck.getTime() < 60000) return
      lastCheck = now
      await backupController.runScheduledBackupIfDue(now)
    } catch (err) {
      console.error('Backup scheduler tick error:', err)
    }
  }, intervalMs)
  if (timer.unref) timer.unref()
  console.log(`Backup scheduler started (every ${intervalMs}ms)`)
}

const stopBackupScheduler = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { startBackupScheduler, stopBackupScheduler }
