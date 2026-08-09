'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user', 'resetToken', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('user', 'resetTokenExpires', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('user', 'resetToken');
    await queryInterface.removeColumn('user', 'resetTokenExpires');
  },
};
