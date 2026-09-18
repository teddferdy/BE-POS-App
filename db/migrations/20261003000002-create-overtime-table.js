'use strict'

// Phase 33 Batch 3 (F-03 R-1) — authoritative migration owner of `overtime`.
//
// The table was previously created only by runtime `db.overtime.sync()`
// (db/models/index.js afterConnect). No migration file references it, so a
// migrated-only database has no `overtime` table at all. This migration
// reproduces the exact schema from db/models/overtime.js (verified against
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
    store: {
      type: Sequelize.INTEGER
    },
    shift_id: {
      allowNull: false,
      type: Sequelize.INTEGER
    },
    employee_id: {
      allowNull: false,
      type: Sequelize.INTEGER
    },
    date: {
      allowNull: false,
      type: Sequelize.DATEONLY
    },
    start_time: {
      allowNull: false,
      type: Sequelize.TIME
    },
    end_time: {
      allowNull: false,
      type: Sequelize.TIME
    },
    duration_hours: {
      allowNull: false,
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    },
    note: {
      type: Sequelize.TEXT
    },
    status: {
      type: Sequelize.STRING(20),
      defaultValue: 'pending'
    },
    decidedBy: {
      type: Sequelize.INTEGER
    },
    decidedAt: {
      type: Sequelize.DATE
    },
    status_history: {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: []
    },
    accounting_status: {
      type: Sequelize.STRING(20),
      defaultValue: 'unposted'
    },
    postedAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    journalId: {
      type: Sequelize.INTEGER,
      allowNull: true
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
      `SELECT to_regclass('public.overtime') IS NOT NULL AS exists`
    )
    if (!tableCheck[0].exists) {
      await queryInterface.createTable('overtime', columns(Sequelize))
      return
    }

    // Table pre-exists (runtime sync / snapshot): additive reconciliation only.
    const desc = await queryInterface.describeTable('overtime')
    const full = columns(Sequelize)
    for (const [name, def] of Object.entries(full)) {
      if (!desc[name]) {
        await queryInterface.addColumn('overtime', name, def)
      }
    }
  },

  async down(queryInterface) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.overtime') IS NOT NULL AS exists`
    )
    if (tableCheck[0].exists) {
      await queryInterface.dropTable('overtime')
    }
  }
}
