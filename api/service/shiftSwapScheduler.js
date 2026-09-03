'use strict'

const { Op } = require('sequelize')
const db = require('../../db/models')
const { createNotification } = require('../../utils/createNotification')
const { tryAcquireSchedulerLock } = require('../../utils/schedulerLock')

const ShiftSwap = db.shift_swap

let timer = null

const toDateOnly = (d) => {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`
}

// Tandai permintaan pending sebagai EXPIRED jika:
//  1. Tanggal shift yang diminta sudah lewat (H+1 setelah tanggal_selesai), ATAU
//  2. Batas approvals dia (expires_at) sudah terlewati.
// Ini mencegah dashboard penuh data sampah swap yang tak lagi relevan.
async function expirePendingSwaps() {
  const today = toDateOnly(Date.now())

  const expired = await ShiftSwap.findAll({
    where: {
      status: 'pending',
      [Op.or]: [
        {
          tanggal_selesai: { [Op.not]: null, [Op.lt]: today }
        },
        {
          tanggal_mulai: { [Op.not]: null, [Op.lt]: today }
        },
        {
          expires_at: { [Op.not]: null, [Op.lt]: new Date() }
        }
      ]
    }
  })

  let count = 0
  for (const swap of expired) {
    const history = Array.isArray(swap.status_history) ? swap.status_history : []

    const [requesterUser, targetUser] = await Promise.all([
      db.user.findByPk(swap.requesterId, { attributes: ['id', 'fullName'] }),
      db.user.findByPk(swap.targetId, { attributes: ['id', 'fullName'] })
    ])

    await ShiftSwap.update(
      {
        status: 'expired',
        status_history: [
          ...history,
          { status: 'expired', by: null, at: new Date().toISOString() }
        ]
      },
      { where: { id: swap.id } }
    )

    await createNotification({
      type: 'shift_swap_expired',
      store: swap.store,
      referenceId: swap.id,
      referenceType: 'shift_swap',
      params: [
        requesterUser?.fullName || `Karyawan #${swap.requesterId}`,
        targetUser?.fullName || `Karyawan #${swap.targetId}`
      ],
      createdBy: null
    })

    count += 1
  }

  if (count > 0) {
    console.log(`[shift-swap] ${count} pending swap expired secara otomatis (${today})`)
  }
  return count
}

const startShiftSwapScheduler = (intervalMs = 5 * 60 * 1000) => {
  if (timer) return
  timer = setInterval(async () => {
    try {
      // Cross-process lease — if this API is scaled to 2+ instances, only
      // one of them expires swaps (and sends the notification) per tick.
      const gotLock = await tryAcquireSchedulerLock(
        db,
        'shift-swap',
        Math.max(intervalMs * 1.2, 360000)
      )
      if (!gotLock) return
      await expirePendingSwaps()
    } catch (err) {
      console.error('Shift swap scheduler tick error:', err)
    }
  }, intervalMs)
  if (timer.unref) timer.unref()
  console.log(`Shift swap scheduler started (every ${intervalMs}ms)`)
}

const stopShiftSwapScheduler = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = {
  startShiftSwapScheduler,
  stopShiftSwapScheduler,
  expirePendingSwaps
}