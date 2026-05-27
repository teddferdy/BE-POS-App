'use strict'
module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define(
    'department',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      description: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      createdBy: {
        type: DataTypes.STRING
      },
      modifiedBy: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'department',
      tableName: 'department'
    }
  )

  Department.associate = (models) => {
    Department.hasMany(models.position, {
      foreignKey: 'departmentId',
      as: 'positions'
    })
  }

  return Department
}
