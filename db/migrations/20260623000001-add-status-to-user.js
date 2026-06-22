'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const statusCol = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'status'`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    if (statusCol.length === 0) {
      await queryInterface.addColumn('user', 'status', {
        type: Sequelize.STRING(20),
        allowNull: true
      })
    }

    await queryInterface.sequelize.query(
      `UPDATE "user" SET "status" = CASE
        WHEN "statusActive" = true THEN 'active'
        WHEN "statusActive" = false THEN 'inactive'
        ELSE 'draft'
      END WHERE "status" IS NULL`
    )

    await queryInterface.sequelize.query(
      `ALTER TABLE "user" ALTER COLUMN "status" SET DEFAULT 'active'`
    )

    const colStatusActive = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'statusActive'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (colStatusActive.length > 0) {
      await queryInterface.removeColumn('user', 'statusActive')
    }

    const colStatusEmployee = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'statusEmployee'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (colStatusEmployee.length > 0) {
      await queryInterface.removeColumn('user', 'statusEmployee')
    }
  },

  async down(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const sActiveCol = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'statusActive'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (sActiveCol.length === 0) {
      await queryInterface.addColumn('user', 'statusActive', {
        type: Sequelize.BOOLEAN,
        allowNull: true
      })
      await queryInterface.sequelize.query(
        `UPDATE "user" SET "statusActive" = CASE WHEN "status" = 'active' THEN true ELSE false END`
      )
    }

    const sEmployeeCol = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'statusEmployee'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (sEmployeeCol.length === 0) {
      await queryInterface.addColumn('user', 'statusEmployee', {
        type: Sequelize.BOOLEAN,
        allowNull: true
      })
      await queryInterface.sequelize.query(
        `UPDATE "user" SET "statusEmployee" = CASE WHEN "status" = 'active' THEN true ELSE false END`
      )
    }

    const col = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'status'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (col.length > 0) {
      await queryInterface.removeColumn('user', 'status')
    }
  }
}
