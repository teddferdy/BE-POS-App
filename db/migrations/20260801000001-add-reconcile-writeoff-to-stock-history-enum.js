'use strict';

module.exports = {
  async up (queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_stock_history_referenceType" ADD VALUE IF NOT EXISTS 'reconcile'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_stock_history_referenceType" ADD VALUE IF NOT EXISTS 'writeoff'`
    );
  },

  async down () {
  }
};
