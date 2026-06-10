'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'invoice_setting';
    const columns = await queryInterface.describeTable(table);

    if (!columns.showLogo) {
      await queryInterface.addColumn(table, 'showLogo', {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'invoice_setting';
    const columns = await queryInterface.describeTable(table);

    if (columns.showLogo) {
      await queryInterface.removeColumn(table, 'showLogo');
    }
  }
};
