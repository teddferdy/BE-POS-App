const db = require('../../db/models')
const Shift = db.shift

exports.getAllShift = async (req, res) => {
  const { page: rawPage, pageSize: rawPageSize, status = 'all' } = req.query
  const page = Math.max(1, parseInt(rawPage) || 1)
  const pageSize = Math.max(1, parseInt(rawPageSize) || 10)

  try {
    const offset = (page - 1) * pageSize

    let statusCondition = {}
    if (status === 'true') {
      statusCondition = { status: true }
    } else if (status === 'false') {
      statusCondition = { status: false }
    }

    const shiftCategory = await Shift.findAll({
      where: {
        ...statusCondition
      },
      limit: pageSize,
      offset
    })

    const totalShifts = await Shift.count({
      where: {
        ...statusCondition
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: shiftCategory,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalItems: totalShifts,
        totalPages: Math.ceil(totalShifts / pageSize)
      }
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
      whereCondition.status = true
    } else if (status === 'inactive') {
      whereCondition.status = false
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
      statusShift: shift.status ? 'active' : 'inactive'
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
    const { name, description, startTime, endTime, createdBy } = req.body
    const findOneShift = await Shift?.findOne({
      where: { name: name }
    })
    if (!findOneShift?.getDataValue) {
      const postData = await Shift.create({
        name: name,
        description: description,
        startTime: startTime,
        endTime: endTime,
        store: req.body.store || req.user?.store,
        createdBy: createdBy
      })
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
  const {
    id,
    nameShift,
    description,
    startHour,
    endHour,
    createdBy,
    modifiedBy
  } = req.body
  try {
    const getDuplicate = await Shift.findOne({
      where: {
        id: id,
        nameShift: nameShift,
        description: description,
        startHour: startHour,
        endHour: endHour
      }
    })
    if (!getDuplicate?.dataValues) {
      const editShift = await Shift?.update(
        {
          nameShift: nameShift,
          description: description,
          startHour: startHour,
          endHour: endHour,
          createdBy: createdBy,
          modifiedBy: modifiedBy
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
  const { id, nameShift } = req.body
  try {
    const getId = await Shift.destroy({
      where: {
        id: id,
        nameShift: nameShift
      },
      force: true
    })
    if (getId) {
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
