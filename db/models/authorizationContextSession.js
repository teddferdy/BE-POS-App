'use strict'

// TASK 3 — server-side authorization context session persistence.
//
// A database-backed session keyed by an opaque sessionId. The JWT carries
// identity (userId) + the opaque session identifier only; all tenant/store
// authority is resolved server-side from persisted membership/assignment/
// lifecycle state on every request (see utils/authContext.js).
module.exports = (sequelize, DataTypes) => {
  const AuthorizationContextSession = sequelize.define(
    'authorizationContextSession',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      sessionId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        // Sessions are ephemeral: they die with the account (CASCADE) so a
        // hard-deleted user never leaves orphan context rows behind.
        references: { model: 'user', key: 'id' },
        onDelete: 'CASCADE'
      },
      activeTenantId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'tenant', key: 'id' },
        onDelete: 'SET NULL'
      },
      activeStoreId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'location', key: 'id' },
        onDelete: 'SET NULL'
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
      }
    },
    {
      paranoid: false,
      freezeTableName: true,
      modelName: 'authorizationContextSession',
      tableName: 'authorization_context_session',
      indexes: [
        { name: 'uq_authorization_context_session_id', unique: true, fields: ['sessionId'] },
        { name: 'ix_authorization_context_session_user', fields: ['userId'] }
      ]
    }
  )

  AuthorizationContextSession.associate = (models) => {
    if (models.user) {
      AuthorizationContextSession.belongsTo(models.user, { foreignKey: 'userId', as: 'user' })
    }
    if (models.tenant) {
      AuthorizationContextSession.belongsTo(models.tenant, { foreignKey: 'activeTenantId', as: 'activeTenant' })
    }
    if (models.location) {
      AuthorizationContextSession.belongsTo(models.location, { foreignKey: 'activeStoreId', as: 'activeStore' })
    }
  }

  return AuthorizationContextSession
}
