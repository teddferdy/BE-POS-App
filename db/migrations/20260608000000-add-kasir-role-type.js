'use strict'

const ENUM_TYPES = ['enum_role_roleType', 'enum_user_roleType']

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const enumTypeName of ENUM_TYPES) {
      const [result] = await queryInterface.sequelize.query(
        `SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'kasir' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}'))`,
        { type: Sequelize.QueryTypes.SELECT }
      )

      if (!result.exists) {
        await queryInterface.sequelize.query(
          `ALTER TYPE "${enumTypeName}" ADD VALUE 'kasir'`
        )
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL does not support removing values from an ENUM.
    // To revert, recreate the database or run sync({ force: true }).
  }
}
