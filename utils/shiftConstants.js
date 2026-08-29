'use strict'

// ============================================================
// Sumber kebenaran tunggal untuk tipe_shift (Shift & ShiftSwap).
// Pastikan tetap sinkron dengan FE-POS-App/src/constants/shiftTypes.js
// agar FE dan BE tidak mismatch tipe data.
// ============================================================

const SHIFT_TYPES = ['harian', 'mingguan']

const DEFAULT_SHIFT_TYPE = 'harian'

const SHIFT_TYPE_LABELS = {
  harian: 'Harian',
  mingguan: 'Mingguan'
}

const shiftSwapStatuses = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'expired'
]

module.exports = {
  SHIFT_TYPES,
  DEFAULT_SHIFT_TYPE,
  SHIFT_TYPE_LABELS,
  shiftSwapStatuses
}