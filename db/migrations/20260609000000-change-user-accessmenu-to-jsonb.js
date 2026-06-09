'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // Set invalid/non-JSON values to empty array
    await queryInterface.sequelize.query(
      `UPDATE "user" SET "accessMenu" = '[]' WHERE "accessMenu" IS NULL OR "accessMenu" = ''`
    )

    // If left doesn't start with [ or {, it's not valid JSON array/object
    await queryInterface.sequelize.query(
      `UPDATE "user" SET "accessMenu" = '[]' WHERE left("accessMenu", 1) NOT IN ('[', '{')`
    )

    // Change column type with USING clause for proper casting
    await queryInterface.sequelize.query(
      `ALTER TABLE "user" ALTER COLUMN "accessMenu" TYPE JSONB USING "accessMenu"::jsonb`
    )

    // Set default value
    await queryInterface.sequelize.query(
      `ALTER TABLE "user" ALTER COLUMN "accessMenu" SET DEFAULT '[]'::jsonb`
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "user" ALTER COLUMN "accessMenu" TYPE TEXT`
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "user" ALTER COLUMN "accessMenu" DROP DEFAULT`
    )
  }
}
