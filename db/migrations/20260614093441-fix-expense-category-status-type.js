'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TABLE expense_category ALTER COLUMN status DROP DEFAULT`)
    await queryInterface.sequelize.query(`
      ALTER TABLE expense_category
      ALTER COLUMN status TYPE VARCHAR(20)
      USING CASE
        WHEN status = true THEN 'active'
        WHEN status = false THEN 'inactive'
        ELSE 'active'
      END
    `)
    await queryInterface.sequelize.query(`ALTER TABLE expense_category ALTER COLUMN status SET DEFAULT 'active'`)
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TABLE expense_category ALTER COLUMN status DROP DEFAULT`)
    await queryInterface.sequelize.query(`
      ALTER TABLE expense_category
      ALTER COLUMN status TYPE BOOLEAN
      USING CASE
        WHEN status = 'active' THEN true
        ELSE false
      END
    `)
    await queryInterface.sequelize.query(`ALTER TABLE expense_category ALTER COLUMN status SET DEFAULT true`)
  }
};
