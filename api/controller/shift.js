/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const Shift = require('../../db/models/shift')

// Get All Shift
exports.getAllShift = async (req, res, next) => {
  const { page = 1, pageSize = 10, status = 'all' } = req.query // Default page = 1, pageSize = 10, status = 'all'

  try {
    const offset = (page - 1) * pageSize // Calculate the offset for pagination

    // Build the where condition based on the status filter
    let statusCondition = {}
    if (status === 'true') {
      statusCondition = { status: true }
    } else if (status === 'false') {
      statusCondition = { status: false }
    }

    // Fetch shifts with pagination and status filter
    const shiftCategory = await Shift.findAll({
      where: {
        ...statusCondition // Add the status condition if applicable
      },
      limit: parseInt(pageSize), // Limit number of shifts per page
      offset: parseInt(offset) // Offset based on the current page
    })

    // Get the total count of shifts for pagination, considering the status filter
    const totalShifts = await Shift.count({
      where: {
        ...statusCondition // Count based on the status filter
      }
    })

    return res.status(200).json({
      message: 'Success',
      data: shiftCategory,
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalShifts, // Total number of shifts
        totalPages: Math.ceil(totalShifts / pageSize) // Total pages
      }
    })
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Post New Shift
exports.postNewShift = async (req, res, next) => {
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
        status: 'success',
        data: postData
      })
    } else {
      return res.status(403).json({
        message: 'Shift Sudah Terdaftar'
      })
    }
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Edit Shift By Id
exports.editShiftById = async (req, res, next) => {
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
        message: 'Sukses Ubah Shift',
        data: editShift?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Shift Sudah Tersedia'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Delete Shift By Id
exports.deleteShiftById = async (req, res, next) => {
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
        message: 'Success Hapus Shift'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Shift Gagal'
      })
    }
  } catch (error) {
    console.log('ERROR =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}
