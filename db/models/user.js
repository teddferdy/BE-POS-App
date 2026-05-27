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
      fullName: {
        type: DataTypes.STRING
      },
      userName: {
        allowNull: true,
        type: DataTypes.STRING,
        unique: true
      },
      password: {
        allowNull: true,
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
      department: {
        type: DataTypes.STRING
      },
      employmentType: {
        type: DataTypes.STRING
      },
      startDate: {
        type: DataTypes.DATEONLY
      },
      statusEmployee: {
        type: DataTypes.BOOLEAN
      },
      statusActive: {
        type: DataTypes.BOOLEAN
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY
      },
      placeOfBirth: {
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
      contractDuration: {
        type: DataTypes.STRING
      },
      endDate: {
        type: DataTypes.DATEONLY
      },
      accessMenu: {
        type: DataTypes.TEXT
      },
      monthlySalary: {
        type: DataTypes.DECIMAL(15, 2)
      },
      dailySalary: {
        type: DataTypes.DECIMAL(15, 2)
      },
      documents: {
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
    User.belongsTo(models.position, {
      foreignKey: 'position',
      as: 'positionData'
    })
  }

  return User
}
