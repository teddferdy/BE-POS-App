'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'shift_swap'",
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (tables.length === 0) {
      await queryInterface.createTable('shift_swap', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        store: {
          type: Sequelize.INTEGER
        },
        requesterId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        targetId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        requesterShiftId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        targetShiftId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        tanggal_mulai: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        tanggal_selesai: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        note: {
          type: Sequelize.TEXT
        },
        status: {
          type: Sequelize.STRING(20),
          defaultValue: 'pending'
        },
        decidedBy: {
          type: Sequelize.INTEGER
        },
        decidedAt: {
          type: Sequelize.DATE
        },
        createdBy: {
          type: Sequelize.INTEGER
        },
        modifiedBy: {
          type: Sequelize.INTEGER
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        deletedAt: {
          type: Sequelize.DATE
        }
      })

      await queryInterface.addIndex('shift_swap', ['status'])
      await queryInterface.addIndex('shift_swap', ['store'])
      await queryInterface.addIndex('shift_swap', ['requesterId'])
      await queryInterface.addIndex('shift_swap', ['targetId'])
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('shift_swap')
  }
}