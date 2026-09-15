'use strict'

// Phase 22 Batch 3 — every existing store safely backfills to
// 'Asia/Jakarta' (this is an Indonesia-focused POS; existing behavior
// implicitly assumed WIB everywhere business dates were computed from
// server/UTC time, so this preserves that assumption as an explicit,
// per-store, overridable default rather than silently continuing to
// infer it from server time). No existing timezone value is overwritten
// since the column does not exist yet — every row gets exactly this one
// default, and any store operator can change it afterward per-store.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('location', 'timezone', {
      type: Sequelize.STRING(50),
      defaultValue: 'Asia/Jakarta'
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('location', 'timezone')
  }
}
