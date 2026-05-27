'use strict'
module.exports = (sequelize, DataTypes) => {
  const Position = sequelize.define(
    'position',
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
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      departmentId: {
        type: DataTypes.INTEGER
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
      modelName: 'position',
      tableName: 'position'
    }
  )

  Position.associate = (models) => {
    Position.belongsTo(models.department, {
      foreignKey: 'departmentId',
      as: 'departmentData'
    })
  }

  return Position
}
