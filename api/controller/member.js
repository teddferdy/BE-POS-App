const db = require('../../db/models')
const Member = db.member
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

exports.getAllMember = async (req, res) => {
  try {
    const { nameMember, phoneNumber, page = 1, limit = 10, store } = req.query
    const filters = {}
    
    if (store) {
      filters.store = store
    }
    
    if (nameMember) {
      filters.nameMember = {
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
    const { store } = req.query

    const member = await Member.findOne({
      where: { id, ...(store && { store }) }
    })

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
        nameMember: body?.nameMember,
        phoneNumber: body?.phoneNumber
      }
    })

    if (!findOneMember?.getDataValue) {
      const createdMember = await Member.create({
        nameMember: body.nameMember,
        phoneNumber: body.phoneNumber,
        store: body.store || body.location,
        createdBy: body.createdBy,
        status: body.status || true,
        point: body.point || 0
      })

      if (createdMember.getDataValue) {
        createAudit(req, 'create', 'member', createdMember.id, `Created member: ${createdMember.nameMember}`)
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
    const { store, nameMember, phoneNumber, status, point } = req.body

    const member = await Member.findOne({
      where: { id, ...(store && { store }) }
    })

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member tidak ditemukan'
      })
    }

    const updateData = {}
    if (nameMember) updateData.nameMember = nameMember
    if (phoneNumber) updateData.phoneNumber = phoneNumber
    if (status !== undefined) updateData.status = status
    if (point !== undefined) updateData.point = point

    const updatedMember = await member.update(updateData)

    createAudit(req, 'update', 'member', id, `Updated member: ${id}`, member.dataValues, updateData)

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
    const { store } = req.query

    const member = await Member.findOne({
      where: { id, ...(store && { store }) }
    })

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member tidak ditemukan'
      })
    }

    await member.destroy()

    createAudit(req, 'delete', 'member', id, `Deleted member: ${member.nameMember}`)

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

      createAudit(req, 'update', 'member', getMember.dataValues.id, `Updated member points: ${getMember.dataValues.nameMember}`)
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