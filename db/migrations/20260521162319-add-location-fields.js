'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      const columns = await queryInterface.describeTable('location')

      if (!columns.village) {
        await queryInterface.addColumn(
          'location',
          'village',
          {
            type: Sequelize.STRING,
            allowNull: true
          },
          { transaction }
        )
      }

      if (!columns.latitude) {
        await queryInterface.addColumn(
          'location',
          'latitude',
          {
            type: Sequelize.FLOAT,
            allowNull: true
          },
          { transaction }
        )
      }

      if (!columns.longitude) {
        await queryInterface.addColumn(
          'location',
          'longitude',
          {
            type: Sequelize.FLOAT,
            allowNull: true
          },
          { transaction }
        )
      }

      if (!columns.description) {
        await queryInterface.addColumn(
          'location',
          'description',
          {
            type: Sequelize.TEXT,
            allowNull: true
          },
          { transaction }
        )
      }

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      const columns = await queryInterface.describeTable('location')

      if (columns.village) {
        await queryInterface.removeColumn('location', 'village', {
          transaction
        })
      }
      if (columns.latitude) {
        await queryInterface.removeColumn('location', 'latitude', {
          transaction
        })
      }
      if (columns.longitude) {
        await queryInterface.removeColumn('location', 'longitude', {
          transaction
        })
      }
      if (columns.description) {
        await queryInterface.removeColumn('location', 'description', {
          transaction
        })
      }

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }
}
