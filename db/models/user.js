'use strict'
const { DataTypes } = require('sequelize')
const bcrypt = require('bcrypt')
const sequelize = require('../../config/database')

const User = sequelize.define(
  'user',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    image: DataTypes.STRING,
    userType: DataTypes.STRING,
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
    address: DataTypes.STRING,
    gender: DataTypes.STRING,
    phoneNumber: DataTypes.STRING,
    employeeID: {
      type: DataTypes.STRING,
      unique: true
    },
    statusEmployee: DataTypes.BOOLEAN,
    statusActive: DataTypes.BOOLEAN,
    placeDateOfBirth: DataTypes.STRING,
    store: DataTypes.INTEGER,
    shift: DataTypes.INTEGER,
    position: DataTypes.INTEGER,
    accessMenu: DataTypes.TEXT,
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    modifiedAt: DataTypes.STRING,
    deletedAt: DataTypes.STRING
  },
  {
    paranoid: true,
    freezeTableName: true,
    modelName: 'user',
    hooks: {
      beforeSave: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10)
        }
      }
    }
  }
)

module.exports = User
