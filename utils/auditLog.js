const db = require('../db/models')

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
  userAgent
}) => {
  try {
    await db.auditLog.create({
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
    })
  } catch (error) {
    console.error('Audit log error:', error)
  }
}

const createAudit = (req, action, entity, entityId, description, oldValues, newValues) => {
  return auditLog({
    store: req.cookies?.store || req.user?.store,
    userId: req.user?.id,
    userName: req.user?.name || req.user?.username,
    action,
    entity,
    entityId,
    description,
    oldValues,
    newValues,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  })
}

module.exports = { auditLog, createAudit }
