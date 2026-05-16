'use strict'
const bcrypt = require('bcrypt')

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'user',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      image: {
        type: DataTypes.STRING
      },
      roleType: {
        type: DataTypes.ENUM('super_admin', 'admin', 'user'),
        defaultValue: 'user'
      },
      roleId: {
        type: DataTypes.INTEGER,
        references: {
          model: 'role',
          key: 'id'
        }
      },
      userType: {
        type: DataTypes.STRING
      },
      userName: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true
      },
      password: {
        allowNull: false,
        type: DataTypes.STRING
      },
      confirmPassword: {
        type: DataTypes.VIRTUAL,
        set(value) {
          if (value !== this.password) {
            throw new Error('Password & Confirmation Password Tidak Sama')
          }
        }
      },
      email: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true
      },
      address: {
        type: DataTypes.STRING
      },
      gender: {
        type: DataTypes.STRING
      },
      phoneNumber: {
        type: DataTypes.STRING
      },
      employeeID: {
        type: DataTypes.STRING,
        unique: true
      },
      statusEmployee: {
        type: DataTypes.BOOLEAN
      },
      statusActive: {
        type: DataTypes.BOOLEAN
      },
      placeDateOfBirth: {
        type: DataTypes.STRING
      },
      store: {
        type: DataTypes.INTEGER
      },
      shift: {
        type: DataTypes.INTEGER
      },
      position: {
        type: DataTypes.INTEGER
      },
      accessMenu: {
        type: DataTypes.TEXT
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      tableName: 'user',
      hooks: {
        beforeSave: async (user) => {
          if (user.changed('password')) {
            user.password = await bcrypt.hash(user.password, 10)
          }
        }
      }
    }
  )

  User.associate = (models) => {
    User.belongsTo(models.role, { foreignKey: 'roleId', as: 'role' })
    User.belongsTo(models.location, { foreignKey: 'store', as: 'storeData' })
    User.belongsTo(models.position, { foreignKey: 'position', as: 'positionData' })
  }

  return User
}