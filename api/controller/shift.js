const { Op } = require('sequelize')
const db = require('../../db/models')
const Shift = db.shift
const User = db.user
const { createAudit } = require('../../utils/auditLog')

const serializeShift = (shift) => ({
  id: shift.id,
  store: shift.store,
  nama_shift: shift.name,
  tipe_shift: shift.tipe_shift || '',
  jam_mulai: shift.startTime,
  jam_selesai: shift.endTime,
  tanggal_mulai: shift.tanggal_mulai,
  tanggal_selesai: shift.tanggal_selesai,
  karyawan: shift.karyawan || [],
  status: shift.status,
  createdAt: shift.createdAt,
  updatedAt: shift.updatedAt
})

const validateTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return null
  return startTime > endTime
    ? 'Jam selesai tidak boleh sebelum jam mulai'
    : null
}

exports.getAllShift = async (req, res) => {
  const {
    page: rawPage,
    pageSize: rawPageSize,
    status = 'all',
    search
  } = req.query
  const page = Math.max(1, parseInt(rawPage) || 1)
  const pageSize = Math.max(1, parseInt(rawPageSize) || 10)

  try {
    const offset = (page - 1) * pageSize

    let statusCondition = {}
    if (status && status !== 'all') {
      statusCondition = { status }
    }

    const where = { ...statusCondition }
    if (req.storeId) where.store = req.storeId
    if (search) where.name = { [Op.iLike]: `%${search}%` }

    const shiftCategory = await Shift.findAll({
      where,
      limit: pageSize,
      offset,
      order: [['createdAt', 'DESC']]
    })

    const totalShifts = await Shift.count({ where })

    const [active, draft, inactive] = await Promise.all([
      Shift.count({ where: { ...where, status: 'active' } }),
      Shift.count({ where: { ...where, status: 'draft' } }),
      Shift.count({ where: { ...where, status: 'inactive' } })
    ])

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
    const whereCondition = {}
    if (req.storeId) whereCondition.store = req.storeId
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
    const store = req.body.store || req.storeId || req.user?.store

    const rangeError = validateTimeRange(jam_mulai, jam_selesai)
    if (rangeError) {
      return res.status(400).json({
        success: false,
        message: rangeError
      })
    }

    const findOneShift = await Shift?.findOne({
      where: { name: nama_shift }
    })
    if (!findOneShift?.getDataValue) {
      const postData = await Shift.create({
        name: nama_shift,
        tipe_shift: tipe_shift || '',
        startTime: jam_mulai,
        endTime: jam_selesai,
        tanggal_mulai,
        tanggal_selesai,
        karyawan: karyawan || [],
        status: status || 'active',
        store,
        createdBy: req.user?.id
      })

      createAudit(
        req,
        'create',
        'shift',
        postData.id,
        `Created shift: ${postData.id}`
      )

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: serializeShift(postData)
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Shift Sudah Terdaftar'
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

exports.editShiftById = async (req, res) => {
  const {
    id,
    nama_shift,
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

    const getDuplicate = await Shift.findOne({
      where: {
        [Op.and]: [
          { id: { [Op.ne]: id } },
          { name: nama_shift || existingShift.name }
        ]
      }
    })
    if (getDuplicate) {
      return res.status(403).json({
        success: false,
        message: 'Shift Sudah Tersedia'
      })
    }

    const editShift = await Shift?.update(
      {
        name: nama_shift,
        tipe_shift: tipe_shift ?? existingShift.tipe_shift,
        startTime: jam_mulai,
        endTime: jam_selesai,
        tanggal_mulai: tanggal_mulai ?? existingShift.tanggal_mulai,
        tanggal_selesai: tanggal_selesai ?? existingShift.tanggal_selesai,
        karyawan: karyawan ?? existingShift.karyawan,
        status: status ?? existingShift.status,
        modifiedBy: req.user?.id
      },
      {
        returning: true,
        where: {
          id: id
        }
      }
    ).then(([_, data]) => {
      return data[0]
    })

    createAudit(req, 'update', 'shift', id, `Updated shift: ${id}`)

    return res.status(200).json({
      success: true,
      message: 'Sukses Ubah Shift',
      data: serializeShift(editShift?.dataValues)
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
  const { id } = req.body
  try {
    // Clean up user.shift references for affected users
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
