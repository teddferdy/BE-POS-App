'use strict'

const TABLES = [
  'category', 'department', 'discount', 'expenseCategory',
  'ingredient', 'invoice_setting', 'location', 'member',
  'memberTier', 'currency', 'position', 'product',
  'role', 'shift', 'social_media', 'supplier',
  'taxConfig', 'type_payment'
]

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      const tableExists = await queryInterface.sequelize.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`,
        { type: Sequelize.QueryTypes.SELECT }
      )
      if (!tableExists[0].exists) continue

      const colExists = await queryInterface.sequelize.query(
        `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'status')`,
        { type: Sequelize.QueryTypes.SELECT }
      )
      if (!colExists[0].exists) continue

      const dataType = await queryInterface.sequelize.query(
        `SELECT data_type FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'status'`,
        { type: Sequelize.QueryTypes.SELECT }
      )
      if (dataType[0]?.data_type !== 'boolean') continue

      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "status" TYPE VARCHAR(20) USING CASE WHEN "status" = true THEN 'active' ELSE 'inactive' END`
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "status" SET DEFAULT 'active'`
      )
    }
  },

  async down(queryInterface, Sequelize) {
    for (const table of TABLES) {
      const tableExists = await queryInterface.sequelize.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`,
        { type: Sequelize.QueryTypes.SELECT }
      )
      if (!tableExists[0].exists) continue

      const colExists = await queryInterface.sequelize.query(
        `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'status')`,
        { type: Sequelize.QueryTypes.SELECT }
      )
      if (!colExists[0].exists) continue

      const dataType = await queryInterface.sequelize.query(
        `SELECT data_type FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'status'`,
        { type: Sequelize.QueryTypes.SELECT }
      )
      if (dataType[0]?.data_type !== 'character varying') continue

      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "status" TYPE BOOLEAN USING CASE WHEN "status" = 'active' THEN true ELSE false END`
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "status" SET DEFAULT true`
      )
    }
  }
}
