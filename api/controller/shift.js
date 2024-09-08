/* eslint-disable no-unused-vars */
const Shift = require('../../db/models/shift')

// Get All Shift
exports.getAllShift = async (req, res, next) => {
  try {
    const shiftCategory = await Shift.findAll()
    return res.status(200).json({
      message: 'Success',
      data: shiftCategory
    })
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
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
  }
}
