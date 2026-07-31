'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const invoiceDesc = await queryInterface.describeTable('invoice_setting')

    if (!invoiceDesc.logo) {
      await queryInterface.addColumn('invoice_setting', 'logo', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }

    if (!invoiceDesc.status || invoiceDesc.status.type === 'BOOLEAN') {
      await queryInterface.sequelize.query(
        `UPDATE invoice_setting SET "status" = 'active' WHERE "status" = true`
      )
      await queryInterface.sequelize.query(
        `UPDATE invoice_setting SET "status" = 'inactive' WHERE "status" = false OR "status" IS NULL`
      )
      await queryInterface.changeColumn('invoice_setting', 'status', {
        type: Sequelize.STRING(20),
        defaultValue: 'active'
      })
    }

    if (
      invoiceDesc.createdBy &&
      invoiceDesc.createdBy.type === 'character varying'
    ) {
      await queryInterface.changeColumn('invoice_setting', 'createdBy', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }

    if (
      invoiceDesc.modifiedBy &&
      invoiceDesc.modifiedBy.type === 'character varying'
    ) {
      await queryInterface.changeColumn('invoice_setting', 'modifiedBy', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }

    const productDesc = await queryInterface.describeTable('product')
    if (!productDesc.estimationTime) {
      await queryInterface.addColumn('product', 'estimationTime', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('invoice_setting', 'modifiedBy', {
      type: Sequelize.STRING
    })
    await queryInterface.changeColumn('invoice_setting', 'createdBy', {
      type: Sequelize.STRING
    })
    await queryInterface.changeColumn('invoice_setting', 'status', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })
    await queryInterface.removeColumn('product', 'estimationTime')
    await queryInterface.removeColumn('invoice_setting', 'logo')
  }
}
