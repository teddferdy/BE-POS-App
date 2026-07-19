'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('order').catch(() => null)
    if (tableDesc && !tableDesc.promoCampaignId) {
      await queryInterface.addColumn('order', 'promoCampaignId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'promo_campaign', key: 'id' }
      })
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('order').catch(() => null)
    if (tableDesc && tableDesc.promoCampaignId) {
      await queryInterface.removeColumn('order', 'promoCampaignId')
    }
  }
}
