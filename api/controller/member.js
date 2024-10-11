/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const Member = require('../../db/models/member')
const { Op } = require('sequelize')

// Get All List
exports.getAllMember = async (req, res, next) => {
  try {
    const { nameMember, phoneNumber } = req.query
    const filters = {}
    if (nameMember || phoneNumber) {
      filters.nameMember = {
        [Op.like]: `${nameMember}%`
      }
      filters.phoneNumber = {
        [Op.like]: `${phoneNumber}%`
      }
    }

    const getAllMember = await Member.findAll({ where: filters }).then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      message: 'Success',
      data: getAllMember?.length > 0 ? getAllMember : []
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

// Add New Member
exports.addNewMember = async (req, res, next) => {
  const body = req.body

  try {
    const findOneMember = await Member?.findOne({
      returning: true,
      where: {
        nameMember: body?.nameMember,
        phoneNumber: body?.phoneNumber
      }
    })

    if (!findOneMember?.getDataValue) {
      const creadtedMember = await Member.create({
        nameMember: body.nameMember,
        phoneNumber: body.phoneNumber,
        store: body.location,
        createdBy: body.createdBy,
        status: body.status,
        point: body.point
      })

      if (creadtedMember.getDataValue) {
        return res.status(200).json({
          message: 'Member Berhasil Di Buat'
        })
      }
    } else {
      return res.status(403).json({
        message: `Member Sudah Terdaftar di ${findOneMember?.getDataValue?.location}`
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

// Edit Member By Id
exports.editMemberById = async (req, res, next) => {
  const body = req.body
  try {
    const getMember = await Member.findOne({
      returning: true,
      where: {
        nameMember: body.nameMember,
        phoneNumber: body?.phoneNumber
      }
    })

    if (getMember?.dataValues) {
      const editMember = await Member?.update(
        {
          point: body.point + Number(getMember?.dataValues?.point)
        },
        {
          returning: true,
          where: {
            id: getMember?.dataValues?.id,
            nameMember: body.nameMember,
            phoneNumber: body?.phoneNumber
          }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        message: 'Sukses',
        data: editMember?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Member Tidak Ditemukan'
      })
    }
  } catch (error) {
    console.log('ERROR BRAY =>', error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}
