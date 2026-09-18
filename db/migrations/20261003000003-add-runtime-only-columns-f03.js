'use strict'

// Phase 33 Batch 3 (F-03 R-2) — migration coverage for runtime-only columns.
//
// These columns were previously added only by the `afterConnect` auto-patch
// (`pendingMigrations` in db/models/index.js). No earlier migration creates
// them, so a migrated-only database lacks them while the application reads
// and writes them. Column definitions below are verified against the current
// model files (authoritative), the runtime patch, scripts/dev-schema.sql,
// and application usage.
//
// INTENTIONAL TYPE DECISIONS (do not "fix" without reading this):
// - purchase_order.additionalCost, goods_receipt_item.costPrice/landedCost
//   are added here as BIGINT, matching the CURRENT models
//   (db/models/purchaseOrder.js, db/models/goodsReceiptItem.js) and the
//   end-state of 20261001000001-purchase-monetary-bigint.js. The stale
//   runtime patch says INTEGER, but this migration is timestamped AFTER the
//   BIGINT conversion, so adding INTEGER here would permanently downgrade
//   fresh chains. Where the column already exists (any type), this migration
//   is a no-op and never alters it.
// - shift_swap.status_history keeps DEFAULT '[]'::jsonb to match the snapshot
//   and the runtime patch (the model allows NULL; existing rows on legacy
//   databases therefore converge to the snapshot shape).
//
// Safety:
// - Every table is existence-checked first; every column is added only when
//   missing. Pre-existing columns and their values are never touched.
// - Down removes a column only when it exists. LIMITATION: down cannot tell
//   a column created by this migration from one that pre-existed via the
//   runtime auto-patch/snapshot, so rolling back on such a database drops a
//   pre-existing column. Forward migration is the safe, supported direction.

function plan(Sequelize) {
  return [
    {
      table: 'purchase_order',
      columns: [
        {
          name: 'additionalCost',
          def: { type: Sequelize.BIGINT, defaultValue: 0 }
        },
        {
          name: 'overDeliveryTolerance',
          def: { type: Sequelize.INTEGER, defaultValue: 10 }
        }
      ]
    },
    {
      table: 'purchase_order_item',
      columns: [
        {
          name: 'conversionToBase',
          def: { type: Sequelize.DECIMAL(10, 4), defaultValue: 1 }
        }
      ]
    },
    {
      table: 'goods_receipt_item',
      columns: [
        {
          name: 'costPrice',
          def: { type: Sequelize.BIGINT, defaultValue: 0 }
        },
        {
          name: 'landedCost',
          def: { type: Sequelize.BIGINT, defaultValue: 0 }
        },
        {
          name: 'conversionToBase',
          def: { type: Sequelize.DECIMAL(10, 4), defaultValue: 1 }
        },
        {
          name: 'qtyStock',
          def: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 }
        }
      ]
    },
    {
      table: 'transaction',
      columns: [{ name: 'salesReturnId', def: { type: Sequelize.INTEGER } }]
    },
    {
      table: 'shift_swap',
      columns: [
        {
          name: 'status_history',
          def: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] }
        },
        {
          name: 'expires_at',
          def: { type: Sequelize.DATE, allowNull: true }
        }
      ]
    },
    {
      table: 'user',
      columns: [
        {
          name: 'overtimeRate',
          def: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 }
        },
        {
          name: 'overtimeFactor',
          def: { type: Sequelize.DECIMAL(10, 2), defaultValue: 1.5 }
        }
      ]
    }
  ]
}

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT to_regclass('public.${table}') IS NOT NULL AS exists`
  )
  return rows[0].exists
}

async function existingColumns(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = '${table}' AND table_schema = 'public'`
  )
  return rows.map((r) => r.column_name)
}

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const { table, columns } of plan(Sequelize)) {
      if (!(await tableExists(queryInterface, table))) continue
      const existing = await existingColumns(queryInterface, table)
      for (const { name, def } of columns) {
        if (!existing.includes(name)) {
          await queryInterface.addColumn(table, name, def)
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    for (const { table, columns } of plan(Sequelize)) {
      if (!(await tableExists(queryInterface, table))) continue
      const existing = await existingColumns(queryInterface, table)
      for (const { name } of columns) {
        if (existing.includes(name)) {
          await queryInterface.removeColumn(table, name)
        }
      }
    }
  }
}
