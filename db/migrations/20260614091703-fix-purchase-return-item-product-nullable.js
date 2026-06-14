'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "purchase_return_item" ALTER COLUMN "product" DROP NOT NULL'
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "purchase_return_item" ALTER COLUMN "product" SET NOT NULL'
    )
  }
}
