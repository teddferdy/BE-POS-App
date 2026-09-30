'use strict'

// T-03B (DR-03 Q8) reactivation freshness marker.
//
// `tenant_membership.reactivatedAt`: NULL = no freshness constraint (every
// existing row, every newly created membership). Set from the database clock
// (NOW()) only on a DEACTIVATED → ACTIVE transition. A session authenticated
// before that instant must not derive authority from the membership: the
// canonical resolver treats it as not effective for that session.
//
// Safety: guarded add-if-missing / remove-if-exists only; pre-existing
// columns and values are never touched. Follows the f03 convention.

function plan(Sequelize) {
  return [
    {
      table: 'tenant_membership',
      columns: [
        {
          name: 'reactivatedAt',
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
