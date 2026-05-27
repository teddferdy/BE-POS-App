'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('position', 'departmentId', {
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
      UPDATE "position" p
      SET "departmentId" = d.id
      FROM "department" d
      WHERE p.department = d.name
    `)

    await queryInterface.removeColumn('position', 'department')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('position', 'department', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.sequelize.query(`
      UPDATE "position" p
      SET department = d.name
      FROM "department" d
      WHERE p."departmentId" = d.id
    `)

    await queryInterface.removeColumn('position', 'departmentId')
  }
}
