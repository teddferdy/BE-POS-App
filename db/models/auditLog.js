"use strict";

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    "auditLog",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      store: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "location", key: "id" },
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      userName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      entity: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      oldValues: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      newValues: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      paranoid: false,
      freezeTableName: true,
      tableName: "auditLog",
    }
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.location, {
      foreignKey: "store",
      as: "storeData",
    });
  };

  return AuditLog;
};
