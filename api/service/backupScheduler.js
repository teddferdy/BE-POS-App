'use strict'
const backupController = require('../controller/backup')
const db = require('../../db/models')
const { tryAcquireSchedulerLock } = require('../../utils/schedulerLock')

let timer = null
let lastCheck = null

const startBackupScheduler = (intervalMs = 60000) => {
  if (timer) return
  timer = setInterval(async () => {
    try {
      const now = new Date()
      if (lastCheck && now.getTime() - lastCheck.getTime() < 60000) return
      // Cross-process lease — if this API is scaled to 2+ instances, only
      // one of them runs the backup on any given tick.
      const gotLock = await tryAcquireSchedulerLock(
        db,
        'backup',
        Math.max(intervalMs * 1.5, 90000)
      )
      if (!gotLock) return
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
