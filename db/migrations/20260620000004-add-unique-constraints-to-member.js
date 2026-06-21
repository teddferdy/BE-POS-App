'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'member')`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (!tableExists[0].exists) return

    // Deduplicate names before adding unique constraint
    const dupNames = await queryInterface.sequelize.query(
      `SELECT name FROM "member" GROUP BY name HAVING COUNT(*) > 1`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    for (const { name } of dupNames) {
      const rows = await queryInterface.sequelize.query(
        `SELECT id FROM "member" WHERE name = :name ORDER BY id`,
        {
          replacements: { name },
          type: Sequelize.QueryTypes.SELECT
        }
      )
      for (let i = 1; i < rows.length; i++) {
        await queryInterface.sequelize.query(
          `UPDATE "member" SET name = :newName WHERE id = :id`,
          {
            replacements: { newName: `${name} (${i})`, id: rows[i].id },
            type: Sequelize.QueryTypes.UPDATE
          }
        )
      }
    }

    await queryInterface.addConstraint('member', {
      fields: ['name'],
      type: 'unique',
      name: 'uq_member_name'
    })
    await queryInterface.addConstraint('member', {
      fields: ['phoneNumber'],
      type: 'unique',
      name: 'uq_member_phoneNumber'
    })
    await queryInterface.addConstraint('member', {
      fields: ['email'],
      type: 'unique',
      name: 'uq_member_email'
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('member', 'uq_member_name').catch(() => {})
    await queryInterface.removeConstraint('member', 'uq_member_phoneNumber').catch(() => {})
    await queryInterface.removeConstraint('member', 'uq_member_email').catch(() => {})
  }
}
