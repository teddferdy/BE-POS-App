'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_batch')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const hasIsActive = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'product_batch' AND column_name = 'isActive'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (hasIsActive.length === 0) return

    await queryInterface.addColumn('product_batch', 'status', {
      type: Sequelize.STRING(20),
      defaultValue: 'active'
    })

    await queryInterface.sequelize.query(
      `UPDATE "product_batch" SET "status" = CASE WHEN "isActive" = true THEN 'active' ELSE 'inactive' END`
    )

    await queryInterface.removeColumn('product_batch', 'isActive')
  },

  async down(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_batch')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    const hasStatus = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'product_batch' AND column_name = 'status'`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (hasStatus.length === 0) return

    await queryInterface.addColumn('product_batch', 'isActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })

    await queryInterface.sequelize.query(
      `UPDATE "product_batch" SET "isActive" = CASE WHEN "status" = 'active' THEN true ELSE false END`
    )

    await queryInterface.removeColumn('product_batch', 'status')
  }
}
