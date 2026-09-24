'use strict'

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'auditLog',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'location', key: 'id' }
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      userName: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      action: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      entity: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      entityId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      oldValues: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      newValues: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      // AUD-1 (DR-20 foundation). All nullable/defaulted: historical rows
      // stay valid; unknowable context stays NULL rather than fabricated.
      // NOTE: no tenant FK yet — the tenant entity itself is NOT IMPLEMENTED
      // (DR-01). tenantId is a forward-compatible context slot.
      actorType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'USER'
      },
      tenantId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      result: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'SUCCESS'
      },
      requestId: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: null
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      },
      source: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: null
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null
      }
    },
    {
      paranoid: false,
      freezeTableName: true,
      tableName: 'auditLog'
    }
  )

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return AuditLog
}
