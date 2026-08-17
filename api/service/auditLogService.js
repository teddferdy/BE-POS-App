const db = require('../../db/models')

const ACTION_TYPES = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
  VOID: 'VOID',
  PRINT: 'PRINT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  STATUS_CHANGE: 'STATUS_CHANGE',
  SETTINGS_CHANGE: 'SETTINGS_CHANGE'
}

const ENTITY_TYPES = {
  ORDER: 'order',
  PRODUCT: 'product',
  CATEGORY: 'category',
  MEMBER: 'member',
  MEMBER_TIER: 'memberTier',
  USER: 'user',
  ROLE: 'role',
  STORE: 'store',
  PAYMENT: 'payment',
  INVOICE: 'invoice',
  CASH_REGISTER: 'cashRegister',
  STOCK_OPNAME: 'stockOpname',
  PURCHASE_ORDER: 'purchaseOrder',
  GOODS_RECEIPT: 'goodsReceipt',
  EXPENSE: 'expense',
  DISCOUNT: 'discount',
  TAX_CONFIG: 'taxConfig',
  SETTINGS: 'settings'
}

async function logAudit({
  store,
  userId,
  userName,
  action,
  entity,
  entityId,
  description,
  oldValues = null,
  newValues = null,
  req = null
}) {
  try {
    const ipAddress = req
      ? req.headers['x-forwarded-for'] ||
        req.ip ||
        req.connection?.remoteAddress ||
        'unknown'
      : 'system'
    const userAgent = req?.headers['user-agent'] || 'system'

    await db.auditLog.create({
      store,
      userId,
      userName,
      action,
      entity,
      entityId,
      description,
      oldValues,
      newValues,
      ipAddress,
      userAgent
    })
  } catch (error) {
    console.error('Audit log error:', error)
  }
}

function createAuditMiddleware(entity) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res)
    const startTime = Date.now()

    const store = req.storeId || req.cookies?.store || req.user?.store
    const userId = req.user?.id
    const userName = req.user?.fullName || req.user?.userName || req.user?.name

    // Capture old values for UPDATE/DELETE
    let oldValues = null
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method) && req.params?.id) {
      try {
        // This would need entity-specific model access
        // For now, we'll log without old values in middleware
        // Controllers should call logAudit directly for full detail
      } catch (e) {
        // ignore
      }
    }

    res.json = function (data) {
      const duration = Date.now() - startTime
      const statusCode = res.statusCode
      const isSuccess = statusCode >= 200 && statusCode < 300

      if (
        isSuccess &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ) {
        const actionMap = {
          POST: ACTION_TYPES.CREATE,
          PUT: ACTION_TYPES.UPDATE,
          PATCH: ACTION_TYPES.UPDATE,
          DELETE: ACTION_TYPES.DELETE
        }

        logAudit({
          store,
          userId,
          userName,
          action: actionMap[req.method],
          entity,
          entityId:
            data?.data?.id || req.params?.id ? parseInt(req.params.id) : null,
          description: `${req.method} ${entity} ${isSuccess ? 'success' : 'failed'}`,
          newValues: req.method !== 'DELETE' ? req.body : null,
          req
        }).catch(() => {})
      }

      return originalJson(data)
    }

    next()
  }
}

module.exports = {
  logAudit,
  createAuditMiddleware,
  ACTION_TYPES,
  ENTITY_TYPES
}
