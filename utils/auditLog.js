const db = require('../db/models')

const AUDIT_ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject',
  IMPORT: 'import',
  VOID: 'void',
  PAYMENT: 'payment',
  REFUND: 'refund',
  LOGIN: 'login',
  STATUS_CHANGE: 'status_change'
})

// Recursively strips fields that must never reach the auditLog JSONB
// columns. Keyed case-insensitively so `passwordHash`, `Password`, and
// `PASSWORD` are all caught by the same entry.
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'otp'
])

function redactValue(value, seen) {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, seen))
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]'
    seen.add(value)
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase()
      if (SENSITIVE_KEYS.has(lowerKey)) {
        out[key] = '[REDACTED]'
      } else if (lowerKey === 'cardnumber' && typeof val === 'string') {
        out[key] = val.length > 4 ? `****${val.slice(-4)}` : '[REDACTED]'
      } else {
        out[key] = redactValue(val, seen)
      }
    }
    return out
  }
  return value
}

// Sequelize model instances must be plain-ified before redaction can
// walk their own properties rather than the model's internal shape.
function toPlain(value) {
  if (value && typeof value.toJSON === 'function') return value.toJSON()
  return value
}

const auditLog = async ({
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
  userAgent,
  transaction
}) => {
  try {
    await db.auditLog.create(
      {
        store,
        userId,
        userName,
        action,
        entity,
        entityId,
        description,
        oldValues: oldValues || null,
        newValues: newValues || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      },
      { transaction: transaction || undefined }
    )
  } catch (error) {
    console.error('Audit log error:', error)
  }
}

// Unchanged signature and behavior — existing ~130 call sites keep
// working exactly as they do today, unredacted. New call sites should
// prefer redactAndAudit() below.
const createAudit = (
  req,
  action,
  entity,
  entityId,
  description,
  oldValues,
  newValues,
  transaction
) => {
  return auditLog({
    store: req.storeId || req.user?.store || req.cookies?.store,
    userId: req.user?.id,
    userName: req.user?.name || req.user?.username,
    action,
    entity,
    entityId,
    description,
    oldValues,
    newValues,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    transaction
  })
}

// The redacting entry point. Same call shape as createAudit but takes
// a single options object (clearer at 7 positional args) and strips
// SENSITIVE_KEYS recursively from both value objects before they are
// ever serialized to JSONB.
const redactAndAudit = (
  req,
  { action, entity, entityId, description, oldValues, newValues, transaction }
) => {
  return createAudit(
    req,
    action,
    entity,
    entityId,
    description,
    redactValue(toPlain(oldValues), new WeakSet()),
    redactValue(toPlain(newValues), new WeakSet()),
    transaction
  )
}

module.exports = { auditLog, createAudit, redactAndAudit, AUDIT_ACTIONS }
