'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'member_tier')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const colInfo = await queryInterface.sequelize.query(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'member_tier' AND column_name = 'status'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!colInfo[0]) return
    if (colInfo[0].data_type === 'boolean') {
      await queryInterface.sequelize.query(
        `ALTER TABLE "member_tier" ALTER COLUMN "status" TYPE VARCHAR(20) USING CASE WHEN "status" = true THEN 'active' ELSE 'inactive' END`
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE "member_tier" ALTER COLUMN "status" SET DEFAULT 'active'`
      )
    }
  },

  async down(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'member_tier')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const colInfo = await queryInterface.sequelize.query(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'member_tier' AND column_name = 'status'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!colInfo[0]) return
    if (colInfo[0].data_type === 'character varying') {
      await queryInterface.sequelize.query(
        `ALTER TABLE "member_tier" ALTER COLUMN "status" TYPE BOOLEAN USING CASE WHEN "status" = 'active' THEN true ELSE false END`
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE "member_tier" ALTER COLUMN "status" SET DEFAULT true`
      )
    }
  }
}
