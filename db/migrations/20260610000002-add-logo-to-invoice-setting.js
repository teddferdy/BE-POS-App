'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'invoice_setting';
    const columns = await queryInterface.describeTable(table);

    if (!columns.logo) {
      await queryInterface.addColumn(table, 'logo', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'invoice_setting';
    const columns = await queryInterface.describeTable(table);

    if (columns.logo) {
      await queryInterface.removeColumn(table, 'logo');
    }
  }
};
