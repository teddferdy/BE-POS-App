'use strict'

// AUD-1 (DR-20 foundation): additive, backward-compatible DR-20 fields on
// the existing auditLog table. All new columns are nullable (or carry a
// server-side default) so historical rows stay valid without backfill.
// No historical value is fabricated: tenant/result context that cannot be
// reconstructed for old rows intentionally stays NULL/default.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('auditLog', 'actorType', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'USER'
    })
    await queryInterface.addColumn('auditLog', 'tenantId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    })
    await queryInterface.addColumn('auditLog', 'result', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'SUCCESS'
    })
    await queryInterface.addColumn('auditLog', 'requestId', {
      type: Sequelize.STRING(64),
      allowNull: true,
      defaultValue: null
    })
    await queryInterface.addColumn('auditLog', 'reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    })
    await queryInterface.addColumn('auditLog', 'source', {
      type: Sequelize.STRING(30),
      allowNull: true,
      defaultValue: null
    })
    await queryInterface.addColumn('auditLog', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null
    })
    // Justified by the tenant-scoped audit-list query pattern that the
    // DR-20 target requires (tenant visibility without full-table scan).
    await queryInterface.addIndex('auditLog', {
      name: 'auditlog_tenant_createdat',
      fields: ['tenantId', 'createdAt']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('auditLog', 'auditlog_tenant_createdat')
    await queryInterface.removeColumn('auditLog', 'metadata')
    await queryInterface.removeColumn('auditLog', 'source')
    await queryInterface.removeColumn('auditLog', 'reason')
    await queryInterface.removeColumn('auditLog', 'requestId')
    await queryInterface.removeColumn('auditLog', 'result')
    await queryInterface.removeColumn('auditLog', 'tenantId')
    await queryInterface.removeColumn('auditLog', 'actorType')
  }
}
