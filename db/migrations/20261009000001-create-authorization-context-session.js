'use strict'

// TASK 3 — authorization context session schema.
//
// SCHEMA ONLY — no data backfill, no production execution here. Creates the
// server-side session table consumed by utils/authorizationContextMiddleware.js.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('authorization_context_session', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      sessionId: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'user', key: 'id' }, onDelete: 'CASCADE' },
      activeTenantId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'tenant', key: 'id' }, onDelete: 'SET NULL' },
      activeStoreId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'location', key: 'id' }, onDelete: 'SET NULL' },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      revokedAt: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    })
    await queryInterface.addIndex('authorization_context_session', {
      name: 'uq_authorization_context_session_id',
      unique: true,
      fields: ['sessionId']
    })
    await queryInterface.addIndex('authorization_context_session', {
      name: 'ix_authorization_context_session_user',
      fields: ['userId']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('authorization_context_session', 'ix_authorization_context_session_user').catch(() => {})
    await queryInterface.removeIndex('authorization_context_session', 'uq_authorization_context_session_id').catch(() => {})
    await queryInterface.dropTable('authorization_context_session')
  }
}
