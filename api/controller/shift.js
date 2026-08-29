const { Op } = require('sequelize')
const db = require('../../db/models')
const Shift = db.shift
const User = db.user
const { DEFAULT_SHIFT_TYPE, SHIFT_TYPES } = require('../../utils/shiftConstants')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')
const {
  syncShiftKaryawan,
  clearRemovedMembers
} = require('../../utils/shiftChain')

const serializeShift = (shift) => ({
  id: shift.id,
  store: shift.store,
  nama_shift: shift.name,
  tipe_shift: SHIFT_TYPES.includes(shift.tipe_shift) ? shift.tipe_shift : DEFAULT_SHIFT_TYPE,
  jam_mulai: shift.startTime,
  jam_selesai: shift.endTime,
  tanggal_mulai: shift.tanggal_mulai,
  tanggal_selesai: shift.tanggal_selesai,
  karyawan: shift.karyawan || [],
  status: shift.status,
  createdBy: shift.createdBy,
  modifiedBy: shift.modifiedBy,
  createdByUser: shift.createdByUser || null,
  modifiedByUser: shift.modifiedByUser || null,
  createdAt: shift.createdAt,
  updatedAt: shift.updatedAt
})

const validateTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return null
  return startTime > endTime
    ? 'Jam selesai tidak boleh sebelum jam mulai'
    : null
}

const toStoreArray = (raw) => {
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => !isNaN(n))
  if (raw !== undefined && raw !== null && raw !== '') return [Number(raw)]
  return []
}

const todayStr = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const autoExpireShifts = async () => {
  const today = todayStr()
  const [count] = await Shift.update(
    { status: 'inactive' },
    {
      where: {
        status: 'active',
        tanggal_selesai: { [Op.ne]: null, [Op.lt]: today }
      }
    }
  )
  if (count > 0) {
    console.log(`[shift] ${count} shift expired -> status inactive (${today})`)
  }
  return count
}

exports.getAllShift = async (req, res) => {
  const {
    page: rawPage,
    pageSize: rawPageSize,
    status = 'all',
    search,
    store: queryStore
  } = req.query
  const page = Math.max(1, parseInt(rawPage) || 1)
  const pageSize = Math.max(1, parseInt(rawPageSize) || 10)

  try {
    await autoExpireShifts()

    const offset = (page - 1) * pageSize

    let statusCondition = {}
    if (status && status !== 'all') {
      statusCondition = { status }
    }

    const where = { ...statusCondition }
    const effectiveStore = req.storeId || (queryStore ? Number(queryStore) : null)
    if (effectiveStore) where.store = effectiveStore
    if (search) where.name = { [Op.iLike]: `%${search}%` }

    const shiftCategory = await Shift.findAll({
      where,
      limit: pageSize,
      offset,
      order: [['updatedAt', 'DESC']]
    })

    const totalShifts = await Shift.count({ where })

    const [active, draft, inactive] = await Promise.all([
      Shift.count({ where: { ...where, status: 'active' } }),
      Shift.count({ where: { ...where, status: 'draft' } }),
      Shift.count({ where: { ...where, status: 'inactive' } })
    ])

    await enrichAuditFields(db, shiftCategory)

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: shiftCategory.map(serializeShift),
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalItems: totalShifts,
        total: totalShifts,
        totalPages: Math.ceil(totalShifts / pageSize)
      },
      stats: { total: active + draft + inactive, active, draft, inactive }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getShiftDropdown = async (req, res) => {
  const { status } = req.query

  try {
    await autoExpireShifts()

    const whereCondition = {}
    if (req.storeId) whereCondition.store = Number(req.storeId)
    if (status === 'active') {
      whereCondition.status = 'active'
    } else if (status === 'inactive') {
      whereCondition.status = 'inactive'
    }

    const shifts = await Shift.findAll({
      where: whereCondition,
      attributes: [
        'id',
        'store',
        'name',
        'startTime',
        'endTime',
        'tipe_shift',
        'tanggal_mulai',
        'tanggal_selesai',
        'karyawan',
        'status'
      ]
    })

    const data = shifts.map((shift) => ({
      id: shift.id,
      storeId: shift.store,
      shiftName: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      karyawan: shift.karyawan || [],
      statusShift: shift.status === 'active' ? 'active' : 'inactive'
    }))

    return res.status(200).json({
      status: 200,
      data
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.postNewShift = async (req, res) => {
  try {
    const {
      nama_shift,
      tipe_shift,
      jam_mulai,
      jam_selesai,
      tanggal_mulai,
      tanggal_selesai,
      karyawan,
      status
    } = req.body
    const rawStore = req.body.store || req.storeId || req.user?.store
    const stores = toStoreArray(rawStore)

    const rangeError = validateTimeRange(jam_mulai, jam_selesai)
    if (rangeError) {
      return res.status(400).json({
        success: false,
        message: rangeError
      })
    }

    if (stores.length === 0) {
      const existing = await Shift.findOne({ where: { name: nama_shift, store: null } })
      if (existing) {
        return res.status(403).json({ success: false, message: 'Shift Sudah Terdaftar' })
      }
const postData = await Shift.create({
         name: nama_shift,
         tipe_shift: SHIFT_TYPES.includes(tipe_shift) ? tipe_shift : DEFAULT_SHIFT_TYPE,
         startTime: jam_mulai,
         endTime: jam_selesai,
         tanggal_mulai,
         tanggal_selesai,
         karyawan: karyawan || [],
         status: status || 'active',
         store: null,
         createdBy: req.user?.id
       })

       createAudit(req, 'create', 'shift', postData.id, `Created shift: ${postData.id}`)

       await enrichAuditFields(db, [postData])

       await syncShiftKaryawan({
         shiftId: postData.id,
         employeeIds: karyawan || []
       })

       return res.status(200).json({
         success: true,
         message: 'Success',
         data: serializeShift(postData)
       })
    }

    if (stores.length === 1) {
      const existing = await Shift.findOne({ where: { name: nama_shift, store: stores[0] } })
      if (existing) {
        return res.status(403).json({ success: false, message: 'Shift Sudah Terdaftar' })
      }
const postData = await Shift.create({
         name: nama_shift,
         tipe_shift: SHIFT_TYPES.includes(tipe_shift) ? tipe_shift : DEFAULT_SHIFT_TYPE,
         startTime: jam_mulai,
         endTime: jam_selesai,
         tanggal_mulai,
         tanggal_selesai,
         karyawan: karyawan || [],
         status: status || 'active',
         store: stores[0],
         createdBy: req.user?.id
       })

       createAudit(req, 'create', 'shift', postData.id, `Created shift: ${postData.id}`)

       await enrichAuditFields(db, [postData])

       await syncShiftKaryawan({
         shiftId: postData.id,
         employeeIds: karyawan || []
       })

       return res.status(200).json({
         success: true,
         message: 'Success',
         data: serializeShift(postData)
       })
    }

    const created = []
    for (const storeId of stores) {
      const existing = await Shift.findOne({ where: { name: nama_shift, store: storeId } })
      if (existing) continue
const postData = await Shift.create({
         name: nama_shift,
         tipe_shift: SHIFT_TYPES.includes(tipe_shift) ? tipe_shift : DEFAULT_SHIFT_TYPE,
         startTime: jam_mulai,
         endTime: jam_selesai,
         tanggal_mulai,
         tanggal_selesai,
         karyawan: karyawan || [],
         status: status || 'active',
         store: storeId,
         createdBy: req.user?.id
       })

       createAudit(req, 'create', 'shift', postData.id, `Created shift: ${postData.id}`)

       await enrichAuditFields(db, [postData])

       await syncShiftKaryawan({
         shiftId: postData.id,
         employeeIds: karyawan || []
       })

       created.push(serializeShift(postData))
    }

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: created.length === 1 ? created[0] : created
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editShiftById = async (req, res) => {
  const {
    id,
    nama_shift,
    store,
    tipe_shift,
    jam_mulai,
    jam_selesai,
    tanggal_mulai,
    tanggal_selesai,
    karyawan,
    status
  } = req.body

  try {
    const rangeError = validateTimeRange(jam_mulai, jam_selesai)
    if (rangeError) {
      return res.status(400).json({
        success: false,
        message: rangeError
      })
    }

    const existingShift = await Shift.findByPk(id)
    if (!existingShift) {
      return res.status(404).json({
        success: false,
        message: 'Shift Tidak Ditemukan'
      })
    }

    const stores = toStoreArray(store)

    const duplicateWhere = { // nosemgrep: Sequelize SQL query, nilai divalidasi zod + koersi — bukan NoSQL injection
      id: { [Op.ne]: id },
      name: nama_shift || existingShift.name
    }
    if (stores.length > 0) {
      duplicateWhere.store = { [Op.in]: stores }
    }
    const getDuplicate = await Shift.findOne({ // nosemgrep: Sequelize SQL query — bukan NoSQL injection
      where: duplicateWhere
    })
    if (getDuplicate) {
      return res.status(403).json({
        success: false,
        message: 'Shift Sudah Tersedia'
      })
    }

    if (stores.length <= 1) {
const editShift = await Shift?.update(
         {
           name: nama_shift,
           store: stores.length === 1 ? stores[0] : existingShift.store,
           tipe_shift: tipe_shift ?? existingShift.tipe_shift,
           startTime: jam_mulai,
           endTime: jam_selesai,
           tanggal_mulai: tanggal_mulai ?? existingShift.tanggal_mulai,
           tanggal_selesai: tanggal_selesai !== undefined ? tanggal_selesai : existingShift.tanggal_selesai,
           karyawan: karyawan ?? existingShift.karyawan,
           status: status ?? existingShift.status,
           modifiedBy: req.user?.id
         },
         {
           returning: true,
           where: { id }
         }
       ).then(([_, data]) => data[0])

       createAudit(req, 'update', 'shift', id, `Updated shift: ${id}`)

       await enrichAuditFields(db, [editShift])

       const newKaryawan = karyawan ?? existingShift.karyawan
       await syncShiftKaryawan({ shiftId: id, employeeIds: newKaryawan })
       await clearRemovedMembers({
         shiftId: id,
         oldKaryawan: existingShift.karyawan,
         newKaryawan
       })

       return res.status(200).json({
         success: true,
         message: 'Sukses Ubah Shift',
         data: serializeShift(editShift)
       })
    }

    const baseData = {
      name: nama_shift,
      tipe_shift: tipe_shift ?? existingShift.tipe_shift,
      startTime: jam_mulai,
      endTime: jam_selesai,
      tanggal_mulai: tanggal_mulai ?? existingShift.tanggal_mulai,
      tanggal_selesai: tanggal_selesai !== undefined ? tanggal_selesai : existingShift.tanggal_selesai,
      karyawan: karyawan ?? existingShift.karyawan,
      status: status ?? existingShift.status,
      modifiedBy: req.user?.id
    }

    await Shift.destroy({ where: { id } })

    const created = []
    for (const storeId of stores) {
const postData = await Shift.create({ ...baseData, store: storeId, createdBy: existingShift.createdBy })

       createAudit(req, 'update', 'shift', postData.id, `Updated shift: ${postData.id}`)

       await enrichAuditFields(db, [postData])

       await syncShiftKaryawan({ shiftId: postData.id, employeeIds: karyawan ?? existingShift.karyawan })

       created.push(serializeShift(postData))
    }

    await clearRemovedMembers({
      shiftId: id,
      oldKaryawan: existingShift.karyawan,
      newKaryawan: karyawan ?? existingShift.karyawan
    })

    return res.status(200).json({
      success: true,
      message: 'Sukses Ubah Shift',
      data: created.length === 1 ? created[0] : created
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteShiftById = async (req, res) => {
  const { id } = req.params
  try {
    await User.update({ shift: null }, { where: { shift: id } })

    const getId = await Shift.destroy({
      where: {
        id: id
      }
    })
    if (getId) {
      createAudit(req, 'delete', 'shift', id, `Deleted shift: ${id}`)

      return res.status(200).json({
        success: true,
        message: 'Success Hapus Shift'
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Hapus Shift Gagal'
      })
    }
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getShiftById = async (req, res) => {
  const { id } = req.params
  try {
    await autoExpireShifts()

    const shift = await Shift.findByPk(id)
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift Tidak Ditemukan'
      })
    }

    await enrichAuditFields(db, [shift])
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: serializeShift(shift)
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
