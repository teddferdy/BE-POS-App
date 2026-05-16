const db = require('../../db/models')
const Shift = db.shift

exports.getAllShift = async (req, res) => {
  const { page = 1, pageSize = 10, status = 'all' } = req.query

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
      limit: parseInt(pageSize),
      offset: parseInt(offset)
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
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
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

exports.postNewShift = async (req, res) => {
  try {
    const { nameShift, description, startHour, endHour, createdBy } = req.body
    const findOneShift = await Shift?.findOne({
      where: {
        nameShift: nameShift
      }
    })
    if (!findOneShift?.getDataValue) {
      const postData = await Shift.create({
        nameShift: nameShift,
        description: description,
        startHour: startHour,
        endHour: endHour,
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