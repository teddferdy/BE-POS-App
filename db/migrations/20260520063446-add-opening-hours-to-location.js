'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('location', 'openingHours', {
      type: Sequelize.JSONB
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('location', 'openingHours');
  }
};
