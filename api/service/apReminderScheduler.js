'use strict'
const db = require('../../db/models')
const { tryAcquireSchedulerLock } = require('../../utils/schedulerLock')
const { generateApReminders } = require('./apReminderService')

// Phase 22 Batch 4 — mirrors accountingOutboxScheduler.js exactly: same
// setInterval + cross-process DB lease pattern already proven for the
// other three schedulers in this codebase. Reused deliberately rather
// than inventing a second scheduler architecture.
//
// KNOWN LIMITATION (inherited, not introduced by this batch): like every
// other setInterval-based scheduler here, this is only started when
// `!process.env.VERCEL` (see api/index.js) — Vercel serverless functions
// don't keep a process alive between requests, so setInterval never
// fires there. vercel.json has no `crons` entry, so on a Vercel
// deployment NONE of the four pre-existing schedulers (nor this one)
// currently run automatically. This is a pre-existing, already-accepted
// architectural characteristic of this codebase (not new to Batch 4);
// see the final report's Findings section rather than a silent gap.

let timer = null
let running = false

const startApReminderScheduler = (intervalMs = 60000) => {
  if (timer) return
  timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      const gotLock = await tryAcquireSchedulerLock(
        db,
        'ap-reminder',
        Math.max(intervalMs * 1.5, 90000)
      )
      if (!gotLock) return
      const result = await generateApReminders({ limit: 200 })
      if (result.created > 0) {
        console.log(
          `AP reminders: evaluated ${result.evaluated}, eligible ${result.eligible}, created ${result.created}, duplicate ${result.skippedDuplicate}`
        )
      }
    } catch (err) {
      console.error('AP reminder scheduler tick error:', err)
    } finally {
      running = false
    }
  }, intervalMs)
  if (timer.unref) timer.unref()
  console.log(`AP reminder scheduler started (every ${intervalMs}ms)`)
}

const stopApReminderScheduler = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { startApReminderScheduler, stopApReminderScheduler }
