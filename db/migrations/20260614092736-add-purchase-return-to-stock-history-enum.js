'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_stock_history_referenceType" ADD VALUE IF NOT EXISTS 'purchase_return'`
    );
  },

  async down (queryInterface, Sequelize) {
    // PostgreSQL does not support removing values from an enum.
    // A full recreation of the enum type would be required to revert.
  }
};
