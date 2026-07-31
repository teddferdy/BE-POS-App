'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('ALTER TABLE sales_return ALTER COLUMN "returnedBy" DROP NOT NULL')
    await queryInterface.sequelize.query(`
      ALTER TABLE sales_return 
      ALTER COLUMN "returnedBy" TYPE INTEGER USING (
        CASE 
          WHEN "returnedBy" ~ '^[0-9]+$' THEN CAST("returnedBy" AS INTEGER)
          ELSE NULL
        END
      )
    `)
    
    const salesReturnItemTable = await queryInterface.describeTable('sales_return_item')
    if (!salesReturnItemTable.orderItem) {
      await queryInterface.addColumn('sales_return_item', 'orderItem', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE sales_return 
      ALTER COLUMN "returnedBy" TYPE VARCHAR(255)
    `)
  }
}

