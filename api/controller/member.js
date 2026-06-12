const db = require('../../db/models')
const Member = db.member
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

exports.getAllMember = async (req, res) => {
  try {
    const { nameMember, phoneNumber, page = 1, limit = 10 } = req.query
    const filters = {}

    if (nameMember) {
      filters.name = {
        [Op.like]: `%${nameMember}%`
      }
    }

    if (phoneNumber) {
      filters.phoneNumber = {
        [Op.like]: `%${phoneNumber}%`
      }
    }

    const offset = (page - 1) * limit

    const { count, rows } = await Member.findAndCountAll({
      where: filters,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: rows,
      pagination: {
        total: count,
        totalPages: Math.ceil(count / limit),
        page: parseInt(page),
        limit: parseInt(limit)
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

exports.getMemberById = async (req, res) => {
  try {
    const { id } = req.params

    const member = await Member.findByPk(id)

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member tidak ditemukan'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: member
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
        name: body?.nameMember,
        phoneNumber: body?.phoneNumber
      }
    })

    if (!findOneMember?.getDataValue) {
      const createdMember = await Member.create({
        name: body.nameMember,
        phoneNumber: body.phoneNumber,
        email: body.email,
        dateOfBirth: body.birthDate,
        gender: body.gender,
        address: body.address,
        tier: body.tier === '' ? null : body.tier,
        status:
          body.status !== undefined
            ? body.status === true
              ? 'active'
              : body.status === false
                ? 'inactive'
                : body.status
            : 'active',
        totalPoints: body.point || 0,
        lifetimePoints: body.point || 0,
        createdBy: body.createdBy
      })

      if (createdMember.getDataValue) {
        createAudit(
          req,
          'create',
          'member',
          createdMember.id,
          `Created member: ${createdMember.name}`
        )
        return res.status(201).json({
          success: true,
          message: 'Member Berhasil Di Buat',
          data: createdMember
        })
      }
    } else {
      return res.status(403).json({
        success: false,
        message: `Member Sudah Terdaftar`
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

exports.editMember = async (req, res) => {
  try {
    const { id } = req.params
    const {
      nameMember,
      phoneNumber,
      email,
      birthDate,
      gender,
      address,
      tier,
      status,
      point
    } = req.body

    const member = await Member.findByPk(id)

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member tidak ditemukan'
      })
    }

    const updateData = {}
    if (nameMember) updateData.name = nameMember
    if (phoneNumber) updateData.phoneNumber = phoneNumber
    if (email !== undefined) updateData.email = email
    if (birthDate !== undefined) updateData.dateOfBirth = birthDate
    if (gender !== undefined) updateData.gender = gender
    if (address !== undefined) updateData.address = address
    if (tier !== undefined) updateData.tier = tier === '' ? null : tier
    if (status !== undefined) updateData.status = status
    if (point !== undefined) {
      updateData.totalPoints = point
      updateData.lifetimePoints = point
    }
    updateData.modifiedBy = req.user?.id

    const updatedMember = await member.update(updateData)

    createAudit(
      req,
      'update',
      'member',
      id,
      `Updated member: ${id}`,
      member.dataValues,
      updateData
    )

    return res.status(200).json({
      success: true,
      message: 'Member berhasil diperbarui',
      data: updatedMember
    })
  } catch (error) {
    console.error('Error =>', error)

    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteMember = async (req, res) => {
  try {
    const { id } = req.params

    const member = await Member.findByPk(id)

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member tidak ditemukan'
      })
    }

    await member.destroy()

    createAudit(
      req,
      'delete',
      'member',
      id,
      `Deleted member: ${member.nameMember}`
    )

    return res.status(200).json({
      success: true,
      message: 'Member berhasil dihapus'
    })
  } catch (error) {
    console.error('Error =>', error)

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
      where: {
        name: body.nameMember,
        phoneNumber: body?.phoneNumber
      }
    })

    if (getMember) {
      const addedPoints = Number(body.point) || 0
      const newTotal = getMember.totalPoints + addedPoints
      const newLifetime = getMember.lifetimePoints + addedPoints

      await getMember.update({
        totalPoints: newTotal,
        lifetimePoints: newLifetime
      })

      createAudit(
        req,
        'update',
        'member',
        getMember.id,
        `Updated member points: ${getMember.name}`
      )
      return res.status(200).json({
        success: true,
        message: 'Sukses',
        data: getMember
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
