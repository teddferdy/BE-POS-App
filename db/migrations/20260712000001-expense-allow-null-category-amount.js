'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "expense" ALTER COLUMN "category" DROP NOT NULL`
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "expense" ALTER COLUMN "amount" DROP NOT NULL`
    )
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "expense" ALTER COLUMN "category" SET NOT NULL`
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "expense" ALTER COLUMN "amount" SET NOT NULL`
    )
  }
}
