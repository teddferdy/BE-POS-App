'use strict'
module.exports = (sequelize, DataTypes) => {
  const journal_entry_line = sequelize.define(
    'journal_entry_line',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      journalEntry: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      account: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      debit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      credit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      description: {
        type: DataTypes.TEXT
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'journal_entry_line',
      tableName: 'journal_entry_line'
    }
  )

  journal_entry_line.associate = (db) => {
    journal_entry_line.belongsTo(db.account, {
      foreignKey: 'account',
      as: 'accountData'
    })
  }

  return journal_entry_line
}
