"use strict";

module.exports = (sequelize, DataTypes) => {
  const Currency = sequelize.define(
    "currency",
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
      code: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      symbol: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      exchangeRate: {
        type: DataTypes.DECIMAL(18, 6),
        allowNull: false,
        defaultValue: 1.0,
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      modifiedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      paranoid: true,
      freezeTableName: true,
      tableName: "currency",
    }
  );

  Currency.associate = (models) => {
    Currency.belongsTo(models.location, {
      foreignKey: "store",
      as: "storeData",
    });
  };

  return Currency;
};
