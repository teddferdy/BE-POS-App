'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bom_header', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' },
        onDelete: 'SET NULL'
      },
      productId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'product', key: 'id' },
        onDelete: 'CASCADE'
      },
      name: { type: Sequelize.STRING },
      totalQty: { type: Sequelize.INTEGER, defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      createdBy: { type: Sequelize.INTEGER },
      modifiedBy: { type: Sequelize.INTEGER },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deletedAt: { type: Sequelize.DATE }
    })

    await queryInterface.createTable('bom_line', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      bomHeaderId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'bom_header', key: 'id' },
        onDelete: 'CASCADE'
      },
      ingredientId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'ingredient', key: 'id' },
        onDelete: 'CASCADE'
      },
      qty: { type: Sequelize.INTEGER, defaultValue: 0 },
      unit: { type: Sequelize.STRING, defaultValue: 'pcs' },
      notes: { type: Sequelize.TEXT },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deletedAt: { type: Sequelize.DATE }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bom_line')
    await queryInterface.dropTable('bom_header')
  }
}
