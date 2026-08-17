'use strict'
module.exports = (sequelize, DataTypes) => {
  const supplier_contact = sequelize.define(
    'supplier_contact',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      supplier: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      fullName: {
        allowNull: false,
        type: DataTypes.STRING
      },
      position: {
        type: DataTypes.STRING
      },
      email: {
        type: DataTypes.STRING
      },
      phone: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'supplier_contact',
      tableName: 'supplier_contact'
    }
  )

  supplier_contact.associate = (models) => {
    supplier_contact.belongsTo(models.supplier, {
      foreignKey: 'supplier',
      as: 'supplierData'
    })
  }

  return supplier_contact
}
