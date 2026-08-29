'use strict'
module.exports = (sequelize, DataTypes) => {
  const ProductReview = sequelize.define(
    'product_review',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      productId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      userName: {
        allowNull: false,
        type: DataTypes.STRING(100)
      },
      rating: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      comment: {
        type: DataTypes.TEXT
      },
      orderId: {
        type: DataTypes.INTEGER
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'published'
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
      modelName: 'product_review',
      tableName: 'product_review'
    }
  )

  ProductReview.associate = (models) => {
    ProductReview.belongsTo(models.product, { foreignKey: 'productId' })
  }

  return ProductReview
}