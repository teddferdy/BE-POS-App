const db = require('../../db/models')
const Member = db.member
const { Op } = require('sequelize')

exports.getAllMember = async (req, res) => {
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
      success: true,
      message: 'Success',
      data: getAllMember?.length > 0 ? getAllMember : []
    })
  } catch (error) {
    console.error('Error =>', error)

    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.addNewMember = async (req, res) => {
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
          success: true,
          message: 'Member Berhasil Di Buat'
        })
      }
    } else {
      return res.status(403).json({
        success: false,
        message: `Member Sudah Terdaftar di ${findOneMember?.getDataValue?.location}`
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editMemberById = async (req, res) => {
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
        success: true,
        message: 'Sukses',
        data: editMember?.dataValues
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Member Tidak Ditemukan'
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