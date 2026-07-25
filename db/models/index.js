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
  const store = userContext.getStore()
  if (!store?.userId) return

  if (rawAttrs.createdBy && !instance.getDataValue('createdBy')) {
    const type = rawAttrs.createdBy.type?.key || ''
    const value = type === 'STRING' ? (store.userName || store.userId) : store.userId
    instance.setDataValue('createdBy', value)
  }
})

sequelize.addHook('beforeSave', (instance) => {
  if (instance.isNewRecord) return
  const rawAttrs = instance.constructor?.rawAttributes || {}
  const store = userContext.getStore()
  if (!store?.userId) return

  if (rawAttrs.modifiedBy && !instance.getDataValue('modifiedBy')) {
    const type = rawAttrs.modifiedBy.type?.key || ''
    const value = type === 'STRING' ? (store.userName || store.userId) : store.userId
    instance.setDataValue('modifiedBy', value)
  }
})

sequelize.addHook('beforeBulkUpdate', (options) => {
  const store = userContext.getStore()
  if (!store?.userId) return
  if (options.attributes && options.attributes.modifiedBy !== undefined) return
  const rawAttrs = options.model?.rawAttributes || {}
  if (rawAttrs.modifiedBy) {
    const type = rawAttrs.modifiedBy.type?.key || ''
    const value = type === 'STRING' ? (store.userName || store.userId) : store.userId
    options.attributes = options.attributes || {}
    options.attributes.modifiedBy = value
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

const { enrichAuditFields } = require('../../utils/auditFields')

Object.keys(db).forEach((modelName) => {
  const model = db[modelName]
  if (typeof model !== 'function' || !model.rawAttributes) return
  const rawAttrs = model.rawAttributes
  if (!rawAttrs.createdBy && !rawAttrs.modifiedBy) return
  model.addHook('afterFind', async (result) => {
    try {
      if (!result) return
      const records = Array.isArray(result) ? result : [result]
      await enrichAuditFields(db, records)
    } catch (e) {
      console.error(`afterFind hook error for ${model.name}:`, e.message)
    }
  })
})

// ponytail: removed broken beforeSave hook that set updatedAt=null on create

db.sequelize = sequelize
db.Sequelize = Sequelize

const pendingMigrations = [
  {
    table: 'supplier_product',
    columns: [
      { name: 'unit', definition: 'VARCHAR(20) DEFAULT \'pcs\'' },
      { name: 'leadTimeUnit', definition: 'VARCHAR(10) DEFAULT \'hari\'' },
      { name: 'notes', definition: 'TEXT' }
    ]
  },
  {
    table: 'role',
    columns: [
      { name: 'isSystem', definition: 'BOOLEAN DEFAULT false NOT NULL' }
    ]
  }
]

async function ensureColumns() {
  for (const migration of pendingMigrations) {
    try {
      const [tableCheck] = await sequelize.query(
        `SELECT to_regclass('public.${migration.table}') IS NOT NULL AS exists`
      )
      if (!tableCheck[0].exists) continue

      const [colCheck] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = '${migration.table}' AND table_schema = 'public'`
      )
      const existing = colCheck.map((c) => c.column_name)

      for (const col of migration.columns) {
        if (!existing.includes(col.name)) {
          await sequelize.query(
            `ALTER TABLE "${migration.table}" ADD COLUMN "${col.name}" ${col.definition}`
          )
          console.log(`[auto-migrate] Added column ${migration.table}.${col.name}`)
        }
      }
    } catch (e) {
      console.error(`[auto-migrate] Error for ${migration.table}:`, e.message)
    }
  }
}

sequelize.addHook('afterConnect', async () => {
  if (sequelize._autoMigrateDone) return
  sequelize._autoMigrateDone = true
  await ensureColumns()
  try {
    await sequelize.query(`UPDATE role SET "isSystem" = true WHERE "createdBy" IS NULL AND "isSystem" = false`)
  } catch (e) {
    console.error('[auto-migrate] Error updating role isSystem:', e.message)
  }
})

module.exports = db
