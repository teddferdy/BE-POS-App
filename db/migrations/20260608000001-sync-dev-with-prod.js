'use strict'

async function columnExists(queryInterface, table, column) {
  const result = await queryInterface.sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`,
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  )
  return result.length > 0
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await columnExists(queryInterface, 'product', 'imageName'))
      await queryInterface.removeColumn('product', 'imageName')
    if (await columnExists(queryInterface, 'category', 'imageName'))
      await queryInterface.removeColumn('category', 'imageName')
    if (await columnExists(queryInterface, 'invoice_logo', 'imageName'))
      await queryInterface.removeColumn('invoice_logo', 'imageName')
    if (await columnExists(queryInterface, 'location', 'imageName'))
      await queryInterface.removeColumn('location', 'imageName')
    if (await columnExists(queryInterface, 'location', 'nameStore'))
      await queryInterface.removeColumn('location', 'nameStore')
  },

  down: async (queryInterface, Sequelize) => {
    if (!(await columnExists(queryInterface, 'product', 'imageName')))
      await queryInterface.addColumn('product', 'imageName', { type: Sequelize.STRING })
    if (!(await columnExists(queryInterface, 'category', 'imageName')))
      await queryInterface.addColumn('category', 'imageName', { type: Sequelize.STRING })
    if (!(await columnExists(queryInterface, 'invoice_logo', 'imageName')))
      await queryInterface.addColumn('invoice_logo', 'imageName', { type: Sequelize.STRING })
    if (!(await columnExists(queryInterface, 'location', 'imageName')))
      await queryInterface.addColumn('location', 'imageName', { type: Sequelize.STRING })
    if (!(await columnExists(queryInterface, 'location', 'nameStore')))
      await queryInterface.addColumn('location', 'nameStore', { type: Sequelize.STRING })
  }
}
