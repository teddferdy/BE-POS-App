'use strict'

const { Op } = require('sequelize')
const db = require('../../db/models')
const { createAudit } = require('../../utils/auditLog')

const ShiftSwap = db.shift_swap
const User = db.user
const Shift = db.shift
const Location = db.location

const USER_INCLUDE = [
  {
    model: User,
    as: 'requesterUser',
    attributes: [
      'id',
      'fullName',
      'email',
      'phoneNumber',
      'store',
      'image',
      'roleType',
      'status',
    ],
    include: [
      { model: db.position, as: 'positionData' },
      { model: db.department, as: 'departmentData' },
      { model: Location, as: 'storeData' }
    ]
  },
  {
    model: User,
    as: 'targetUser',
    attributes: [
      'id',
      'fullName',
      'email',
      'phoneNumber',
      'store',
      'image',
      'roleType',
      'status',
    ],
    include: [
      { model: db.position, as: 'positionData' },
      { model: db.department, as: 'departmentData' },
      { model: Location, as: 'storeData' }
    ]
  }
]

const SHIFT_INCLUDE = [
  { model: Shift, as: 'requesterShift' },
  { model: Shift, as: 'targetShift' }
]

const DECIDER_INCLUDE = [
  {
    model: User,
    as: 'decidedByUser',
    attributes: ['id', 'fullName', 'userName'],
    required: false
  }
]

const resolveStore = (req) => {
  if (req.user?.roleType === 'super_admin') {
    return req.storeId ? Number(req.storeId) : null
  }
  return req.storeId ? Number(req.storeId) : null
}

const getSwapWhere = (req, { includeStatus = true } = {}) => {
  const where = {}
  const store = resolveStore(req)
  if (store) where.store = store

  const { status } = req.query
  if (includeStatus && status) {
    if (['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
      where.status = status
    }
  }
  return where
}

exports.getShiftSwaps = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 10
    const offset = (page - 1) * pageSize

    const where = getSwapWhere(req)

    const [rows, count] = await Promise.all([
      ShiftSwap.findAll({
        where,
        include: [...USER_INCLUDE, ...SHIFT_INCLUDE, ...DECIDER_INCLUDE],
        order: [
          ['status', 'ASC'],
          ['createdAt', 'DESC']
        ],
        limit: pageSize,
        offset
      }),
      ShiftSwap.count({ where })
    ])

    const pendingWhere = { ...where, status: 'pending' }
    const approvedWhere = { ...where, status: 'approved' }
    const rejectedWhere = { ...where, status: 'rejected' }

    const [pending, approved, rejectedTotal, total] = await Promise.all([
      ShiftSwap.count({ where: pendingWhere }),
      ShiftSwap.count({ where: approvedWhere }),
      ShiftSwap.count({ where: rejectedWhere }),
      ShiftSwap.count({ where })
    ])

    res.json({
      success: true,
      message: 'Berhasil mengambil data ubah jadwal',
      data: rows,
      pagination: {
        page,
        pageSize,
        totalPage: Math.ceil(count / pageSize),
        total: count
      },
      stats: {
        pending,
        approved,
        rejected: rejectedTotal,
        total
      }
    })
  } catch (error) {
    next(error)
  }
}

exports.createShiftSwap = async (req, res, next) => {
  try {
    const {
      store,
      requesterId,
      targetId,
      requesterShiftId,
      targetShiftId,
      tanggal_mulai,
      tanggal_selesai,
      note
    } = req.body

    if (!targetId || !requesterShiftId || !targetShiftId) {
      return res.status(400).json({
        success: false,
        message: 'Target, shift pemohon, dan shift target wajib diisi'
      })
    }

    const finalRequesterId = Number(requesterId) || req.user.id

    if (Number(finalRequesterId) === Number(targetId)) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat mengubah jadwal dengan diri sendiri'
      })
    }

    const [requesterUser, targetUser, requesterShift, targetShift] =
      await Promise.all([
        User.findByPk(finalRequesterId),
        User.findByPk(targetId),
        Shift.findByPk(requesterShiftId),
        Shift.findByPk(targetShiftId)
      ])

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Karyawan target tidak ditemukan'
      })
    }
    if (!requesterShift || !targetShift) {
      return res.status(404).json({
        success: false,
        message: 'Shift tidak ditemukan'
      })
    }

    const targetStore = req.user?.roleType === 'super_admin' ? Number(store) || targetUser.store : Number(targetUser.store)
    const requesterStore = requesterUser ? Number(requesterUser.store) : targetStore

    if (requesterStore !== targetStore) {
      return res.status(400).json({
        success: false,
        message: 'Ubah jadwal hanya dapat dilakukan dengan karyawan di toko yang sama'
      })
    }

    const dup = await ShiftSwap.findOne({
      where: {
        requesterId: finalRequesterId,
        targetId: targetId,
        status: 'pending'
      }
    })
    if (dup) {
      return res.status(400).json({
        success: false,
        message: 'Masih ada permintaan ubah jadwal yang menunggu untuk karyawan yang sama'
      })
    }

    const swapData = {
      store: targetStore,
      requesterId: finalRequesterId,
      targetId: Number(targetId),
      requesterShiftId: Number(requesterShiftId),
      targetShiftId: Number(targetShiftId),
      tanggal_mulai: tanggal_mulai || null,
      tanggal_selesai: tanggal_selesai || null,
      note: note || null,
      status: 'pending'
    }

    const created = await ShiftSwap.create(swapData)

    await createAudit(
      req,
      'create',
      'shift_swap',
      created.id,
      `Permintaan ubah jadwal dibuat: ${requesterUser?.fullName || finalRequesterId} <-> ${targetUser.fullName}`
    )

    res.status(201).json({
      success: true,
      message: 'Permintaan ubah jadwal berhasil diajukan',
      data: created
    })
  } catch (error) {
    next(error)
  }
}

exports.updateShiftSwapStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const swap = await ShiftSwap.findByPk(id, {
      include: [...USER_INCLUDE, ...SHIFT_INCLUDE]
    })

    if (!swap) {
      return res.status(404).json({
        success: false,
        message: 'Permintaan ubah jadwal tidak ditemukan'
      })
    }

    if (swap.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Permintaan ini sudah diputuskan sebelumnya'
      })
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status harus approved atau rejected'
      })
    }

    swap.status = status
    swap.decidedBy = req.user.id
    swap.decidedAt = new Date()
    await swap.save()

    await createAudit(
      req,
      'update',
      'shift_swap',
      swap.id,
      `Permintaan ubah jadwal ${status}: ${swap.requesterUser?.fullName || swap.requesterId} <-> ${swap.targetUser?.fullName || swap.targetId}`
    )

    res.json({
      success: true,
      message: status === 'approved' ? 'Permintaan disetujui' : 'Permintaan ditolak',
      data: swap
    })
  } catch (error) {
    next(error)
  }
}