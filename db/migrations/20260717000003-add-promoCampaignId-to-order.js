'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('order', 'promoCampaignId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'promo_campaign', key: 'id' }
    })

    await queryInterface.addIndex('order', ['promoCampaignId'], {
      where: { deletedAt: null }
    })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('order', ['promoCampaignId'])
    await queryInterface.removeColumn('order', 'promoCampaignId')
  }
}
