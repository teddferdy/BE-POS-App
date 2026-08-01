const db = require('../../db/models')
const Member = db.member
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

exports.getAllMember = async (req, res) => {
  try {
    const {
      nameMember,
      phoneNumber,
      page = 1,
      limit = 10,
      tier,
      status
    } = req.query
    const filters = {}

    let store = req.query.store || req.user?.store
    if (req.user?.roleType !== 'super_admin') {
      store = req.user?.store
    }
    if (store) {
      filters.store = store
    }

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

    if (tier != null) {
      filters.tier = tier
    }

    if (status) {
      filters.status = status
    }

    const offset = (page - 1) * limit

    const { count, rows } = await Member.findAndCountAll({
      where: filters,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    })
    await enrichAuditFields(db, rows)

    const totalMembers = await Member.count({ where: filters })
    const activeCount = await Member.count({
      where: { ...filters, status: 'active' }
    })
    const draftCount = await Member.count({
      where: { ...filters, status: 'draft' }
    })
    const inactiveCount = await Member.count({
      where: { ...filters, status: 'inactive' }
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
      },
      stats: {
        total: totalMembers,
        active: activeCount,
        draft: draftCount,
        inactive: inactiveCount
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
    const { page = 1, limit = 5 } = req.query
    const store =
      req.user?.roleType === 'super_admin'
        ? req.storeId || null
        : req.user?.store || null

    const member = store
      ? await Member.findOne({ where: { id, store } })
      : await Member.findByPk(id)

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member tidak ditemukan'
      })
    }

    const offset = (parseInt(page) - 1) * parseInt(limit)
    const orderWhere = { customerId: id, ...(store ? { store } : {}) }
    const { count, rows: orders } = await db.order.findAndCountAll({
      where: orderWhere,
      include: [
        { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'orderNumber',
        'totalPrice',
        'status',
        'createdAt',
        'store'
      ],
      limit: parseInt(limit),
      offset
    })

    const allOrders = await db.order.findAll({
      where: orderWhere,
      attributes: ['totalPrice']
    })
    const totalSpent = allOrders.reduce(
      (sum, o) => sum + (Number(o.totalPrice) || 0),
      0
    )

    const transactions = orders.map((o) => ({
      id: o.id,
      code: o.orderNumber,
      invoice: o.orderNumber,
      date: o.createdAt,
      store: o.storeData?.name || `Store #${o.store}`,
      storeName: o.storeData?.name || `Store #${o.store}`,
      amount: Number(o.totalPrice) || 0,
      total: Number(o.totalPrice) || 0,
      status: o.status === 'paid' ? 'completed' : o.status
    }))

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        ...member.toJSON(),
        transactions,
        totalSpent,
        transactionPagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
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

exports.addNewMember = async (req, res) => {
  const body = req.body

  try {
    const store =
      req.user?.roleType === 'super_admin'
        ? body.store || null
        : req.user?.store || null

    if (body?.nameMember) {
      const nameExists = await Member.findOne({
        where: { name: body.nameMember, ...(store !== null ? { store } : { store: null }) },
        raw: true
      })
      if (nameExists) {
        return res
          .status(409)
          .json({ success: false, message: 'Nama member sudah terdaftar' })
      }
    }
    if (body?.phoneNumber) {
      const phoneExists = await Member.findOne({
        where: {
          phoneNumber: body.phoneNumber,
          ...(store !== null ? { store } : { store: null })
        },
        raw: true
      })
      if (phoneExists) {
        return res
          .status(409)
          .json({ success: false, message: 'Nomor telepon sudah terdaftar' })
      }
    }
    if (body?.email) {
      const emailExists = await Member.findOne({
        where: {
          email: body.email,
          ...(store !== null ? { store } : { store: null })
        },
        raw: true
      })
      if (emailExists) {
        return res
          .status(409)
          .json({ success: false, message: 'Email sudah terdaftar' })
      }
    }

    const phoneNumber =
      body.phoneNumber && body.phoneNumber.trim() !== ''
        ? body.phoneNumber
        : `GUEST-${Date.now()}`

    const createdMember = await Member.create({
      store,
      name: body.nameMember,
      phoneNumber,
      email: body.email || null,
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
      lifetimePoints: body.point || 0
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
  } catch (error) {
    console.error('Error =>', error)
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors?.[0]?.path || 'field'
      return res.status(409).json({
        success: false,
        message: `${field} sudah digunakan`
      })
    }
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

    if (
      req.user?.roleType !== 'super_admin' &&
      member.store &&
      Number(member.store) !== Number(req.user?.store)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengedit member ini'
      })
    }

    if (nameMember) {
      const nameExists = await Member.findOne({
        where: {
          name: nameMember,
          id: { [Op.ne]: id },
          ...(member.store ? { store: member.store } : { store: null })
        },
        raw: true
      })
      if (nameExists) {
        return res
          .status(409)
          .json({ success: false, message: 'Nama member sudah terdaftar' })
      }
    }
    if (phoneNumber) {
      const phoneExists = await Member.findOne({
        where: {
          phoneNumber,
          id: { [Op.ne]: id },
          ...(member.store ? { store: member.store } : { store: null })
        },
        raw: true
      })
      if (phoneExists) {
        return res
          .status(409)
          .json({ success: false, message: 'Nomor telepon sudah terdaftar' })
      }
    }
    if (email) {
      const emailExists = await Member.findOne({
        where: {
          email,
          id: { [Op.ne]: id },
          ...(member.store ? { store: member.store } : { store: null })
        },
        raw: true
      })
      if (emailExists) {
        return res
          .status(409)
          .json({ success: false, message: 'Email sudah terdaftar' })
      }
    }

    const updateData = {}
    if (nameMember) updateData.name = nameMember
    if (phoneNumber) updateData.phoneNumber = phoneNumber
    if (email !== undefined) updateData.email = email || null
    if (birthDate !== undefined) updateData.dateOfBirth = birthDate
    if (gender !== undefined) updateData.gender = gender
    if (address !== undefined) updateData.address = address
    if (tier !== undefined) updateData.tier = tier === '' ? null : tier
    if (status !== undefined) updateData.status = status
    if (point !== undefined) {
      updateData.totalPoints = point
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

    if (
      req.user?.roleType !== 'super_admin' &&
      member.store &&
      Number(member.store) !== Number(req.user?.store)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk menghapus member ini'
      })
    }

    await member.destroy()

    createAudit(
      req,
      'delete',
      'member',
      id,
      `Deleted member: ${member.name}`
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
  const phoneNumber = String(req.params.phoneNumber || '')
  try {
    const store =
      req.user?.roleType === 'super_admin'
        ? req.storeId || null
        : req.user?.store || null

    const getMember = await Member.findOne({
      where: {
        [Op.or]: [
          { phoneNumber },
          ...(Number(phoneNumber) > 0 ? [{ id: Number(phoneNumber) }] : [])
        ],
        ...(store ? { store } : {})
      }
    })

    if (getMember) {
      const addedPoints = Number(body.points) || 0
      const newTotal = (getMember.totalPoints || 0) + addedPoints
      const newLifetime = (getMember.lifetimePoints || 0) + addedPoints

      await getMember.update({
        totalPoints: newTotal,
        lifetimePoints: newLifetime
      })

      await db.member_point_history.create({
        member: getMember.id,
        pointsChange: addedPoints,
        pointsBefore: getMember.totalPoints,
        pointsAfter: newTotal,
        notes: 'Manual points adjustment'
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
