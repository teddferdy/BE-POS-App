'use strict'
module.exports = (sequelize, DataTypes) => {
  const Overtime = sequelize.define(
    'overtime',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      shift_id: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      employee_id: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      start_time: {
        allowNull: false,
        type: DataTypes.TIME
      },
      end_time: {
        allowNull: false,
        type: DataTypes.TIME
      },
      duration_hours: {
        allowNull: false,
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
      },
      note: {
        type: DataTypes.TEXT
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
      },
      decidedBy: {
        type: DataTypes.INTEGER
      },
      decidedAt: {
        type: DataTypes.DATE
      },
      status_history: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []
      },
      accounting_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'unposted'
      },
      postedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      journalId: {
        type: DataTypes.INTEGER,
        allowNull: true
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
      modelName: 'overtime',
      tableName: 'overtime'
    }
  )

  Overtime.associate = (models) => {
    Overtime.belongsTo(models.shift, { foreignKey: 'shift_id', as: 'shift' })
    Overtime.belongsTo(models.user, {
      foreignKey: 'employee_id',
      as: 'employee'
    })
    Overtime.belongsTo(models.user, {
      foreignKey: 'decidedBy',
      as: 'decidedByUser'
    })
    Overtime.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return Overtime
}