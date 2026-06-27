'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_stock_history_referenceType" ADD VALUE IF NOT EXISTS 'transfer'`
    );
  },

  async down (queryInterface, Sequelize) {
  }
};
