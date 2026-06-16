const db = require('../db/models')

const userCache = {}

async function enrichAuditFields(records) {
  if (!records || !Array.isArray(records)) return
  const ids = new Set()
  records.forEach((r) => {
    const dv = r.dataValues || r
    if (dv.createdBy && !isNaN(dv.createdBy)) ids.add(String(dv.createdBy))
    if (dv.modifiedBy && !isNaN(dv.modifiedBy)) ids.add(String(dv.modifiedBy))
  })
  if (ids.size === 0) return

  const userIds = [...ids].map(Number).filter((id) => id > 0)
  if (userIds.length === 0) return

  const users = await db.user.findAll({
    where: { id: userIds },
    attributes: ['id', 'userName', 'fullName']
  })
  users.forEach((u) => {
    userCache[String(u.id)] = { id: u.id, userName: u.userName, fullName: u.fullName }
  })

  records.forEach((r) => {
    const dv = r.dataValues || r
    if (dv.createdBy && !isNaN(dv.createdBy)) {
      const info = userCache[String(dv.createdBy)]
      if (info) dv.createdByUser = info
    }
    if (dv.modifiedBy && !isNaN(dv.modifiedBy)) {
      const info = userCache[String(dv.modifiedBy)]
      if (info) dv.modifiedByUser = info
    }
  })
}

module.exports = { enrichAuditFields }
