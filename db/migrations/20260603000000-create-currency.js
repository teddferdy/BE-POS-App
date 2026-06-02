"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("currency", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      store: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "location", key: "id" },
        onDelete: "SET NULL",
      },
      code: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      symbol: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      exchangeRate: {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
        defaultValue: 1.0,
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      modifiedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deletedAt: {
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("currency");
  },
};
