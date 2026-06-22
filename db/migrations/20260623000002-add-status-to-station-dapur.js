'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'station_dapur')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const hasIsActive = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'station_dapur' AND column_name = 'isActive'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (hasIsActive.length === 0) return

    await queryInterface.addColumn('station_dapur', 'status', {
      type: Sequelize.STRING(20),
      defaultValue: 'active'
    })

    await queryInterface.sequelize.query(
      `UPDATE "station_dapur" SET "status" = CASE WHEN "isActive" = true THEN 'active' ELSE 'inactive' END`
    )

    await queryInterface.removeColumn('station_dapur', 'isActive')
  },

  async down(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'station_dapur')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const hasStatus = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'station_dapur' AND column_name = 'status'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (hasStatus.length === 0) return

    await queryInterface.addColumn('station_dapur', 'isActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })

    await queryInterface.sequelize.query(
      `UPDATE "station_dapur" SET "isActive" = CASE WHEN "status" = 'active' THEN true ELSE false END`
    )

    await queryInterface.removeColumn('station_dapur', 'status')
  }
}
