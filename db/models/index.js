/* eslint-disable no-undef */
'use strict'

const fs = require('fs')
const path = require('path')
const Sequelize = require('sequelize')
const process = require('process')

const basename = path.basename(__filename)
const env = process.env.NODE_ENV || 'development'
const config = require(__dirname + '/../../config/config.js')[env]
const db = {}

let sequelize
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config)
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  )
}

const userContext = require('../../utils/userContext')

sequelize.addHook('beforeCreate', (instance) => {
  const rawAttrs = instance.constructor?.rawAttributes || {}
  const userId = userContext.getStore()?.userId
  if (!userId) return

  if (rawAttrs.createdBy && !instance.getDataValue('createdBy')) {
    instance.setDataValue('createdBy', userId)
  }
})

sequelize.addHook('beforeSave', (instance) => {
  const rawAttrs = instance.constructor?.rawAttributes || {}
  const userId = userContext.getStore()?.userId
  if (!userId) return

  if (rawAttrs.modifiedBy && !instance.getDataValue('modifiedBy')) {
    instance.setDataValue('modifiedBy', userId)
  }
})

sequelize.addHook('beforeBulkUpdate', (options) => {
  const userId = userContext.getStore()?.userId
  if (!userId) return
  if (options.attributes && options.attributes.modifiedBy !== undefined) return
  const rawAttrs = options.model?.rawAttributes || {}
  if (rawAttrs.modifiedBy) {
    options.attributes = options.attributes || {}
    options.attributes.modifiedBy = userId
  }
})

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    )
  })
  .forEach((file) => {
    const modelDef = require(path.join(__dirname, file))

    let model
    if (typeof modelDef === 'function') {
      model = modelDef(sequelize, Sequelize.DataTypes)
    } else if (modelDef && typeof modelDef === 'object') {
      model = modelDef
    }

    if (model && model.name) {
      db[model.name] = model
    }
  })

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

db.sequelize = sequelize
db.Sequelize = Sequelize

module.exports = db
