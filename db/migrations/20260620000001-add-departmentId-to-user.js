'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('user')
    if (!table.departmentId) {
      await queryInterface.addColumn('user', 'departmentId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'department',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      })

      await queryInterface.sequelize.query(`
        UPDATE "user" u
        SET "departmentId" = d.id
        FROM "department" d
        WHERE u.department = d.name
      `)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user', 'departmentId')
  }
}
