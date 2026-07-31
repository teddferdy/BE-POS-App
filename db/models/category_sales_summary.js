'use strict'
module.exports = (sequelize, DataTypes) => {
  const category_sales_summary = sequelize.define(
    'category_sales_summary',
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
      category: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      report_date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      quantity_sold: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      revenue: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      cost: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      profit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'category_sales_summary',
      tableName: 'category_sales_summary',
      indexes: [
        { fields: ['store', 'category', 'report_date'] },
        { fields: ['report_date'] }
      ]
    }
  )

  category_sales_summary.associate = (models) => {
    category_sales_summary.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    category_sales_summary.belongsTo(models.category, {
      foreignKey: 'category',
      as: 'categoryData'
    })
  }

  return category_sales_summary
}
