'use strict'
module.exports = (sequelize, DataTypes) => {
  const bom_line = sequelize.define(
    'bom_line',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      bomHeaderId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      ingredientId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      qty: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      notes: {
        type: DataTypes.TEXT
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'bom_line',
      tableName: 'bom_line'
    }
  )

  bom_line.associate = (models) => {
    bom_line.belongsTo(models.bom_header, {
      foreignKey: 'bomHeaderId',
      as: 'header'
    })
    bom_line.belongsTo(models.ingredient, {
      foreignKey: 'ingredientId',
      as: 'ingredientData'
    })
  }

  return bom_line
}
