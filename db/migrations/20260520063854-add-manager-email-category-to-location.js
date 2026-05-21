'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('location', 'managerName', {
      type: Sequelize.STRING
    });
    await queryInterface.addColumn('location', 'email', {
      type: Sequelize.STRING
    });
    await queryInterface.addColumn('location', 'category', {
      type: Sequelize.STRING
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('location', 'managerName');
    await queryInterface.removeColumn('location', 'email');
    await queryInterface.removeColumn('location', 'category');
  }
};
