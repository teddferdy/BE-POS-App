const db = require('../../db/models')
const Shift = db.shift
const User = db.user
const { createAudit } = require('../../utils/auditLog')

exports.getAllShift = async (req, res) => {
  const { page: rawPage, pageSize: rawPageSize, status = 'all' } = req.query
  const page = Math.max(1, parseInt(rawPage) || 1)
  const pageSize = Math.max(1, parseInt(rawPageSize) || 10)

  try {
    const offset = (page - 1) * pageSize

    let statusCondition = {}
    if (status === 'true') {
      statusCondition = { status: 'active' }
    } else if (status === 'false') {
      statusCondition = { status: 'inactive' }
    }

    const shiftCategory = await Shift.findAll({
      where: {
        ...statusCondition
      },
      limit: pageSize,
      offset,
      order: [['createdAt', 'DESC']]
    })

    const totalShifts = await Shift.count({
      where: {
        ...statusCondition
      }
    })

    const [active, draft, inactive] = await Promise.all([
      Shift.count({ where: { status: 'active' } }),
      Shift.count({ where: { status: 'draft' } }),
      Shift.count({ where: { status: 'inactive' } })
    ])

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: shiftCategory,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalItems: totalShifts,
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
  const { store, status } = req.query

  try {
    const whereCondition = {}
    if (store) whereCondition.store = parseInt(store)
    if (status === 'active') {
      whereCondition.status = 'active'
    } else if (status === 'inactive') {
      whereCondition.status = 'inactive'
    }

    const shifts = await Shift.findAll({
      where: whereCondition,
      attributes: ['id', 'store', 'name', 'startTime', 'endTime', 'status']
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
    const { name, description, startTime, endTime } = req.body
    const findOneShift = await Shift?.findOne({
      where: { name: name }
    })
    if (!findOneShift?.getDataValue) {
      const postData = await Shift.create({
        name: name,
        description: description,
        startTime: startTime,
        endTime: endTime,
        store: req.body.store || req.user?.store
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
        data: postData
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
  const { id, name, description, startTime, endTime, createdBy } =
    req.body
  try {
    const getDuplicate = await Shift.findOne({
      where: {
        id: id,
        name: name,
        description: description,
        startTime: startTime,
        endTime: endTime
      }
    })
    if (!getDuplicate?.dataValues) {
      const editShift = await Shift?.update(
        {
          name: name,
          description: description,
          startTime: startTime,
          endTime: endTime,
          createdBy: createdBy
        },
        {
          returning: true,
          where: {
            id: id
          }
        }
      ).then(([_, data]) => {
        return data
      })

      createAudit(req, 'update', 'shift', id, `Updated shift: ${id}`)

      return res.status(200).json({
        success: true,
        message: 'Sukses Ubah Shift',
        data: editShift?.dataValues
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Shift Sudah Tersedia'
      })
    }
  } catch (error) {
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
