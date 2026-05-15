'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'best_selling',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      productId: {
        type: DataTypes.BIGINT
      },
      nameProduct: {
        allowNull: false,
        type: DataTypes.STRING
      },
      image: {
        type: DataTypes.STRING
      },
      totalSelling: {
        type: DataTypes.BIGINT
      },
      createdBy: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'best_selling',
      tableName: 'best_selling'
    }
  )
}