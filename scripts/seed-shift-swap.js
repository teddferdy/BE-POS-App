'use strict'

const db = require('../db/models')

async function run() {
  const existing = await db.shift_swap.count()
  if (existing > 0) {
    console.log('shift_swap sudah punya', existing, 'baris, lewati seed')
    return
  }

  const rows = [
    {
      store: 1,
      requesterId: 16,
      targetId: 17,
      requesterShiftId: 1,
      targetShiftId: 2,
      tanggal_mulai: '2026-08-28',
      tanggal_selesai: '2026-08-31',
      note: 'Minta tukar shift sore, ada keperluan keluarga di pagi hari',
      status: 'pending'
    },
    {
      store: 1,
      requesterId: 17,
      targetId: 18,
      requesterShiftId: 2,
      targetShiftId: 1,
      tanggal_mulai: '2026-09-01',
      tanggal_selesai: '2026-09-03',
      note: 'Tukar sama Mamang untuk awal bulan',
      status: 'pending'
    },
    {
      store: 1,
      requesterId: 18,
      targetId: 16,
      requesterShiftId: 1,
      targetShiftId: 2,
      tanggal_mulai: '2026-08-25',
      tanggal_selesai: '2026-08-26',
      note: 'Contoh riwayat disetujui',
      status: 'approved',
      decidedBy: 19,
      decidedAt: new Date()
    }
  ]

  await db.shift_swap.bulkCreate(rows)
  console.log('Seeded', rows.length, 'shift_swap rows')
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message)
    process.exit(1)
  })