'use strict'

// P1-3 account disablement — separate persisted state from presence `status`.
//
// `user.disabledAt`: NULL = enabled (default for every existing and new row;
// no historical inference — an `inactive` status may mean legacy logout,
// store-deletion effects, or a past admin change, never proof of disablement).
// Non-NULL = disabled at that timestamp and barred from authentication.
//
// Safety: guarded add-if-missing / remove-if-exists only; pre-existing
// columns and values are never touched. Follows the f03 convention.

function plan(Sequelize) {
  return [
    {
      table: 'user',
      columns: [
        {
          name: 'disabledAt',
          def: { type: Sequelize.DATE, allowNull: true, defaultValue: null }
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
