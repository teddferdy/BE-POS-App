'use strict'
module.exports = (sequelize, DataTypes) => {
  const member_point_history = sequelize.define(
    'member_point_history',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      member: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      pointsChange: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      pointsBefore: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      pointsAfter: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      transactionId: {
        type: DataTypes.STRING
      },
      notes: {
        type: DataTypes.TEXT
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'member_point_history',
      tableName: 'member_point_history'
    }
  )

  member_point_history.associate = (models) => {
    member_point_history.belongsTo(models.member, {
      foreignKey: 'member',
      as: 'memberData'
    })
    member_point_history.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'createdByData'
    })
  }

  return member_point_history
}
