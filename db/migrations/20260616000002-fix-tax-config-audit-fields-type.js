'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "tax_config" ALTER COLUMN "createdBy" TYPE VARCHAR(255) USING "createdBy"::TEXT,
       ALTER COLUMN "modifiedBy" TYPE VARCHAR(255) USING "modifiedBy"::TEXT`
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "tax_config" ALTER COLUMN "createdBy" TYPE INTEGER USING NULL,
       ALTER COLUMN "modifiedBy" TYPE INTEGER USING NULL`
    )
  }
}
