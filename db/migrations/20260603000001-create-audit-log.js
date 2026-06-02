"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("auditLog", {
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
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      userName: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      action: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      entity: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      entityId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      oldValues: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      newValues: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      ipAddress: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.TEXT,
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
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("auditLog");
  },
};
