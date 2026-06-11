'use strict'
module.exports = (sequelize, DataTypes) => {
  const bom_header = sequelize.define(
    'bom_header',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      productId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      name: {
        type: DataTypes.STRING
      },
      totalQty: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      notes: {
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
      modelName: 'bom_header',
      tableName: 'bom_header'
    }
  )

  bom_header.associate = (models) => {
    bom_header.belongsTo(models.product, {
      foreignKey: 'productId',
      as: 'productData'
    })
    bom_header.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    bom_header.hasMany(models.bom_line, {
      foreignKey: 'bomHeaderId',
      as: 'lines'
    })
  }

  return bom_header
}
