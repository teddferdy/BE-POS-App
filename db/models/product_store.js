'use strict'

module.exports = (sequelize, DataTypes) => {
  const product_store = sequelize.define(
    'product_store',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      product: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
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
      modelName: 'product_store',
      tableName: 'product_store',
      indexes: [
        {
          unique: true,
          fields: ['product', 'store']
        }
      ]
    }
  )

  product_store.associate = (models) => {
    product_store.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    product_store.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  const reject = (code, message) => ({ ok: false, code, message, tenantId: null })

  const assertTenantConsistentAssignment = async ({
    product,
    storeIds,
    options = {}
  } = {}) => {
    const sequelizeInstance = options.sequelize || sequelize
    const models = sequelizeInstance.models
    const transaction = options.transaction

    const requested = (Array.isArray(storeIds) ? storeIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value > 0)
    const requestedIds = [...new Set(requested)]

    // product === null means "not persisted yet": only the incoming set exists.
    let persistedIds = []
    if (product != null) {
      const productId = Number(product)
      if (!Number.isSafeInteger(productId) || productId <= 0) {
        return reject('PRODUCT_STORE_PRODUCT_INVALID', 'product must be a positive integer')
      }
      const persisted = await models.product_store.findAll({
        where: { product: productId },
        attributes: ['store'],
        paranoid: false,
        transaction
      })
      persistedIds = persisted.map((row) => Number(row.store))
    }

    const allStoreIds = [
      ...new Set([...persistedIds, ...requestedIds])
    ].sort((left, right) => left - right)

    if (allStoreIds.length === 0) {
      return reject(
        'PRODUCT_STORE_UNASSIGNED',
        'product_store rejected: an assignment must name at least one store'
      )
    }

    const stores = await models.location.findAll({
      where: { id: allStoreIds },
      attributes: ['id', 'tenantId'],
      paranoid: false,
      transaction
    })
    const byId = new Map(stores.map((store) => [Number(store.id), store]))

    const missing = allStoreIds.filter((id) => !byId.has(id))
    if (missing.length > 0) {
      return reject(
        'PRODUCT_STORE_STORE_UNKNOWN',
        `product_store rejected: store does not exist (${missing.join(', ')})`
      )
    }

    const tenantIds = [
      ...new Set(allStoreIds.map((id) => byId.get(id).tenantId ?? null))
    ].sort((left, right) => (left === null ? -1 : right === null ? 1 : left - right))

    if (tenantIds.length > 1) {
      if (tenantIds.includes(null)) {
        return reject(
          'PRODUCT_STORE_TENANT_UNRESOLVED',
          'product_store rejected: a store without a tenant cannot be assigned alongside a tenant-owned store'
        )
      }
      return reject(
        'PRODUCT_STORE_CROSS_TENANT',
        `product_store rejected: cross-tenant assignment (${tenantIds.join(', ')})`
      )
    }

    return { ok: true, code: null, message: null, tenantId: tenantIds[0] ?? null }
  }

  const throwOnRejection = (result) => {
    if (!result.ok) throw new Error(result.message)
  }

  const guardSingle = async (instance, options) => {
    const result = await assertTenantConsistentAssignment({
      product: instance.product,
      storeIds: [instance.store],
      options
    })
    throwOnRejection(result)
  }

  const guardBulk = async (instances, options) => {
    const byProduct = new Map()
    for (const instance of instances) {
      const productId = Number(instance.product)
      if (!byProduct.has(productId)) byProduct.set(productId, [])
      byProduct.get(productId).push(instance.store)
    }
    for (const [productId, stores] of byProduct.entries()) {
      const result = await assertTenantConsistentAssignment({
        product: productId,
        storeIds: stores,
        options
      })
      throwOnRejection(result)
    }
  }

  product_store.addHook('beforeCreate', guardSingle)
  product_store.addHook('beforeUpdate', guardSingle)
  product_store.addHook('beforeBulkCreate', guardBulk)

  product_store.assertTenantConsistentAssignment = assertTenantConsistentAssignment

  return product_store
}
