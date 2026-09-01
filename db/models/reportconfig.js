'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'reportConfig',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      config: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'reportConfig',
      tableName: 'report_config'
    }
  )
}
