'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('invoice_setting');
    if (!desc.fontSize) {
      await queryInterface.addColumn('invoice_setting', 'fontSize', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'normal',
        after: 'paperSize'
      });
    }
    if (!desc.fontFamily) {
      await queryInterface.addColumn('invoice_setting', 'fontFamily', {
        type: Sequelize.STRING(30),
        allowNull: true,
        defaultValue: 'monospace',
        after: 'fontSize'
      });
    }
    if (!desc.lineSpacing) {
      await queryInterface.addColumn('invoice_setting', 'lineSpacing', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'normal',
        after: 'fontFamily'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('invoice_setting');
    if (desc.fontSize) {
      await queryInterface.removeColumn('invoice_setting', 'fontSize');
    }
    if (desc.fontFamily) {
      await queryInterface.removeColumn('invoice_setting', 'fontFamily');
    }
    if (desc.lineSpacing) {
      await queryInterface.removeColumn('invoice_setting', 'lineSpacing');
    }
  }
};
