'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('invoice_setting');
    if (!desc.paperSize) {
      await queryInterface.addColumn('invoice_setting', 'paperSize', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: '58mm',
        after: 'footer'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('invoice_setting');
    if (desc.paperSize) {
      await queryInterface.removeColumn('invoice_setting', 'paperSize');
    }
  }
};
