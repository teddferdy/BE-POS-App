'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_stock_transfer_status" ADD VALUE IF NOT EXISTS 'sent'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_stock_transfer_status" ADD VALUE IF NOT EXISTS 'received'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_stock_transfer_status" ADD VALUE IF NOT EXISTS 'cancelled'`
    );
  },

  async down (queryInterface, Sequelize) {
    // PostgreSQL does not support removing values from an enum.
  }
};
