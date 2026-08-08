'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('account', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      code: {
        allowNull: false,
        type: Sequelize.STRING(20)
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING
      },
      type: {
        allowNull: false,
        type: Sequelize.ENUM('asset', 'liability', 'equity', 'revenue', 'expense')
      },
      normalBalance: {
        allowNull: false,
        type: Sequelize.ENUM('debit', 'credit')
      },
      parentId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT
      },
      isSystem: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'active'
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
    await queryInterface.addIndex('account', {
      unique: true,
      fields: ['store', 'code'],
      name: 'account_store_code_unique'
    })
    await queryInterface.addIndex('account', ['store', 'type'], {
      name: 'account_store_type_idx'
    })

    await queryInterface.createTable('journal_entry', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      entryNumber: {
        allowNull: false,
        type: Sequelize.STRING(50)
      },
      date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      description: {
        type: Sequelize.TEXT
      },
      sourceType: {
        type: Sequelize.STRING(30),
        defaultValue: 'manual'
      },
      referenceId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      totalDebit: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      totalCredit: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'posted'
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
    await queryInterface.addIndex('journal_entry', ['store', 'date'], {
      name: 'journal_entry_store_date_idx'
    })

    await queryInterface.createTable('journal_entry_line', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      journalEntry: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'journal_entry',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      account: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'account',
          key: 'id'
        },
        onDelete: 'RESTRICT'
      },
      debit: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      credit: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      description: {
        type: Sequelize.TEXT
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
    await queryInterface.addIndex('journal_entry_line', ['journalEntry'], {
      name: 'journal_entry_line_journal_idx'
    })
    await queryInterface.addIndex('journal_entry_line', ['account'], {
      name: 'journal_entry_line_account_idx'
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('journal_entry_line')
    await queryInterface.dropTable('journal_entry')
    await queryInterface.dropTable('account')
  }
}
