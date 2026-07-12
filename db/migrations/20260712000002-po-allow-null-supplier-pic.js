'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE purchase_order ALTER COLUMN "supplier" DROP NOT NULL`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE purchase_order ALTER COLUMN "pic" DROP NOT NULL`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE purchase_order ALTER COLUMN "supplier" SET NOT NULL`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE purchase_order ALTER COLUMN "pic" SET NOT NULL`
    );
  }
};
