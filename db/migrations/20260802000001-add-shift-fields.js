'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const shiftDesc = await queryInterface.describeTable('shift')

    if (!shiftDesc.tipe_shift) {
      await queryInterface.addColumn('shift', 'tipe_shift', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: ''
      })
    }

    if (!shiftDesc.tanggal_mulai) {
      await queryInterface.addColumn('shift', 'tanggal_mulai', {
        type: Sequelize.DATEONLY,
        allowNull: true
      })
    }

    if (!shiftDesc.tanggal_selesai) {
      await queryInterface.addColumn('shift', 'tanggal_selesai', {
        type: Sequelize.DATEONLY,
        allowNull: true
      })
    }

    if (!shiftDesc.karyawan) {
      await queryInterface.addColumn('shift', 'karyawan', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('shift', 'karyawan')
    await queryInterface.removeColumn('shift', 'tanggal_selesai')
    await queryInterface.removeColumn('shift', 'tanggal_mulai')
    await queryInterface.removeColumn('shift', 'tipe_shift')
  }
}
