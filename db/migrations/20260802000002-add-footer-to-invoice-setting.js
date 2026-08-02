'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('invoice_setting');
    if (!desc.footer) {
      await queryInterface.addColumn('invoice_setting', 'footer', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
        after: 'logo'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('invoice_setting');
    if (desc.footer) {
      await queryInterface.removeColumn('invoice_setting', 'footer');
    }
  }
};
