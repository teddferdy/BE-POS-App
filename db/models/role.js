'use strict'
module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    'role',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      roleType: {
        type: DataTypes.ENUM('super_admin', 'admin', 'user'),
        defaultValue: 'user'
      },
      accessMenu: {
        type: DataTypes.JSONB,
        defaultValue: []
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
      modelName: 'role',
      tableName: 'role'
    }
  )

  Role.associate = (models) => {
    Role.belongsTo(models.location, { foreignKey: 'store', as: 'storeData' })
    Role.hasMany(models.user, { foreignKey: 'roleId', as: 'users' })
  }

  return Role
}