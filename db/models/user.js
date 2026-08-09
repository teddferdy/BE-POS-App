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
        type: DataTypes.ENUM('super_admin', 'admin', 'kasir', 'user'),
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
        allowNull: true,
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
      departmentId: {
        type: DataTypes.INTEGER,
        references: { model: 'department', key: 'id' }
      },
      employmentType: {
        type: DataTypes.STRING
      },
      startDate: {
        type: DataTypes.DATEONLY
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
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
        type: DataTypes.JSONB,
        defaultValue: []
      },
      monthlySalary: {
        type: DataTypes.DECIMAL(15, 2)
      },
      dailySalary: {
        type: DataTypes.DECIMAL(15, 2)
      },
      documents: {
        type: DataTypes.TEXT
      },
      resetToken: {
        allowNull: true,
        type: DataTypes.STRING
      },
      resetTokenExpires: {
        allowNull: true,
        type: DataTypes.DATE
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
      tableName: 'user',
      hooks: {
        beforeSave: async (user) => {
          if (user.changed('password') && user.password) {
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
    User.belongsTo(models.department, {
      foreignKey: 'departmentId',
      as: 'departmentData'
    })
  }

  return User
}
