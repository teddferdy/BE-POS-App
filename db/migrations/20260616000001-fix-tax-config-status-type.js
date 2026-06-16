'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tax_config')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const colInfo = await queryInterface.sequelize.query(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'tax_config' AND column_name = 'status'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (colInfo[0]?.data_type !== 'boolean') return

    await queryInterface.sequelize.query(
      `ALTER TABLE "tax_config" ALTER COLUMN "status" TYPE VARCHAR(20) USING CASE WHEN "status" = true THEN 'active' ELSE 'inactive' END`
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "tax_config" ALTER COLUMN "status" SET DEFAULT 'active'`
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "tax_config" ALTER COLUMN "status" TYPE BOOLEAN USING CASE WHEN "status" = 'active' THEN true ELSE false END`
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "tax_config" ALTER COLUMN "status" SET DEFAULT true`
    )
  }
}
