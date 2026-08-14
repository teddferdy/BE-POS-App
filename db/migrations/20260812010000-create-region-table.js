'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [exists] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.region') IS NOT NULL AS exists`
    )
    if (!exists[0].exists) {
      await queryInterface.createTable('region', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        code: {
          allowNull: false,
          type: Sequelize.STRING(20)
        },
        name: {
          allowNull: false,
          type: Sequelize.STRING(255)
        },
        level: {
          allowNull: false,
          type: Sequelize.STRING(10)
        },
        parentCode: {
          allowNull: true,
          type: Sequelize.STRING(20)
        },
        postalCode: {
          allowNull: true,
          type: Sequelize.STRING(10)
        },
        latitude: {
          allowNull: true,
          type: Sequelize.FLOAT
        },
        longitude: {
          allowNull: true,
          type: Sequelize.FLOAT
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      })
      await queryInterface.addIndex('region', {
        unique: true,
        fields: ['code'],
        name: 'region_code_unique'
      })
      await queryInterface.addIndex('region', ['level'], { name: 'region_level_idx' })
      await queryInterface.addIndex('region', ['parentCode'], { name: 'region_parent_code_idx' })
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('region')
  }
}
