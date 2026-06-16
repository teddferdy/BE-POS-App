"use strict";

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "notification",
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
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      referenceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      referenceType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      createdBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      paranoid: true,
      freezeTableName: true,
      tableName: "notification",
    }
  );

  Notification.associate = (models) => {
    Notification.belongsTo(models.location, {
      foreignKey: "store",
      as: "storeData",
    });
  };

  return Notification;
};
