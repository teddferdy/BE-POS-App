'use strict'

// Phase 33 Batch 3 (F-03 R-1) — authoritative migration owner of `attendance`.
//
// The table was previously created only by runtime `db.attendance.sync()`
// (db/models/index.js afterConnect). No migration file references it, so a
// migrated-only database has no `attendance` table at all. This migration
// reproduces the exact schema from db/models/attendance.js (verified against
// scripts/dev-schema.sql, which was itself generated from Model.sync()).
//
// Safety:
// - If the table already exists (runtime sync / snapshot), only genuinely
//   missing columns are added; existing columns, values, and data are never
//   touched, and the table is never dropped, truncated, or recreated.
// - Down drops the table only if it exists. LIMITATION: down cannot
//   distinguish a table created by this migration from one that pre-existed
//   via runtime sync/snapshot, so rolling back on such a database removes a
//   pre-existing table. Forward migration is the safe, supported direction.

function columns(Sequelize) {
  return {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    userId: {
      allowNull: false,
      type: Sequelize.INTEGER
    },
    store: {
      type: Sequelize.INTEGER
    },
    shiftId: {
      type: Sequelize.INTEGER
    },
    type: {
      type: Sequelize.STRING(20),
      defaultValue: 'check-in'
    },
    absenAt: {
      type: Sequelize.DATE
    },
    latitude: {
      type: Sequelize.DOUBLE
    },
    longitude: {
      type: Sequelize.DOUBLE
    },
    accuracy: {
      type: Sequelize.DOUBLE
    },
    algorithm: {
      type: Sequelize.STRING(20),
      defaultValue: 'gps'
    },
    status: {
      type: Sequelize.STRING(20),
      defaultValue: 'valid'
    },
    note: {
      type: Sequelize.STRING(255)
    },
    createdBy: {
      type: Sequelize.INTEGER
    },
    modifiedBy: {
      type: Sequelize.INTEGER
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE
    },
    deletedAt: {
      type: Sequelize.DATE
    }
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.attendance') IS NOT NULL AS exists`
    )
    if (!tableCheck[0].exists) {
      await queryInterface.createTable('attendance', columns(Sequelize))
      return
    }

    // Table pre-exists (runtime sync / snapshot): additive reconciliation only.
    const desc = await queryInterface.describeTable('attendance')
    const full = columns(Sequelize)
    for (const [name, def] of Object.entries(full)) {
      if (!desc[name]) {
        await queryInterface.addColumn('attendance', name, def)
      }
    }
  },

  async down(queryInterface) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.attendance') IS NOT NULL AS exists`
    )
    if (tableCheck[0].exists) {
      await queryInterface.dropTable('attendance')
    }
  }
}
