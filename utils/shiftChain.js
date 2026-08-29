const { Op } = require('sequelize')
const db = require('../db/models')
const Shift = db.shift
const User = db.user

const normId = (v) => Number(v)

const syncEmployeeShift = async ({ userId, newShiftId }) => {
  const id = normId(userId)
  if (isNaN(id)) return

  const containing = await Shift.findAll({
    where: { karyawan: { [Op.contains]: [id] } }
  })
  for (const shift of containing) {
    const karyawan = shift.karyawan || []
    const next = karyawan.filter((k) => normId(k) !== id)
    if (next.length !== karyawan.length) {
      await shift.update({ karyawan: next })
    }
  }

  const target = newShiftId ? await Shift.findByPk(normId(newShiftId)) : null
  if (target) {
    const karyawan = target.karyawan || []
    if (!karyawan.some((k) => normId(k) === id)) {
      await target.update({ karyawan: [...karyawan, id] })
    }
  }
}

const syncShiftKaryawan = async ({ shiftId, employeeIds }) => {
  const shiftIdNum = normId(shiftId)
  if (isNaN(shiftIdNum)) return

  const ids = (employeeIds || []).map(normId).filter((n) => !isNaN(n) && n > 0)
  if (ids.length === 0) return

  for (const id of ids) {
    await syncEmployeeShift({ userId: id, newShiftId: shiftIdNum })
    await User.update({ shift: shiftIdNum }, { where: { id } })
  }
}

const clearRemovedMembers = async ({ shiftId, oldKaryawan, newKaryawan }) => {
  const shiftIdNum = normId(shiftId)
  if (isNaN(shiftIdNum)) return

  const oldIds = (oldKaryawan || []).map(normId).filter((n) => !isNaN(n))
  const newIds = (newKaryawan || []).map(normId).filter((n) => !isNaN(n))
  const removed = oldIds.filter((id) => !newIds.includes(id))

  if (removed.length > 0) {
    await User.update(
      { shift: null },
      { where: { id: { [Op.in]: removed }, shift: shiftIdNum } }
    )
  }
}

module.exports = { syncEmployeeShift, syncShiftKaryawan, clearRemovedMembers }