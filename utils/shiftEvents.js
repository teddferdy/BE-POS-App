'use strict'

// ============================================================
// Event bus terpusat untuk perubahan data shift/karyawan.
// Sinkronisasi karyawan tidak lagi manual & tersebar: setiap
// mutasi shift yang berhasil (commit) memancarkan event di sini,
// sehingga konsumen lain (mis. payroll di masa depan) bisa
// subscribe tanpa menyentuh controller shift.
//
// Event yang dipancarkan:
//   - employee:shiftChanged   { userId, shiftId }
//   - shift:membersChanged    { shiftId, employeeIds }
//   - shift:membersRemoved    { shiftId, employeeIds }
//   - shift:swapped           { swapId, requesterId, targetId }
// ============================================================

const { EventEmitter } = require('events')

const shiftEvents = new EventEmitter()
shiftEvents.setMaxListeners(100)

module.exports = { shiftEvents }