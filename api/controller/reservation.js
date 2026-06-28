const db = require('../../db/models')
const Reservation = db.reservation
const Table = db.table
const { createAudit } = require('../../utils/auditLog')

exports.getAll = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, size = 10, date, status } = req.query
  const limit = parseInt(size)
  const offset = (parseInt(page) - 1) * limit

  try {
    const where = {}
    if (store) where.store = store
    if (date) where.reservationDate = date
    if (status && status !== 'all') where.status = status

    const { count, rows } = await Reservation.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['reservationDate', 'DESC'],
        ['startTime', 'ASC']
      ]
    })

    const statsWhere = store ? { store } : {};
    const stats = {};
    for (const status of ['pending', 'confirmed', 'cancelled', 'completed', 'no_show']) {
      stats[status] = await Reservation.count({ where: { ...statsWhere, status } });
    }

    return res.status(200).json({
      success: true,
      message: 'Success',
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: rows.map((r) => r.dataValues),
      stats: { total: count, ...stats }
    })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.getById = async (req, res) => {
  const { id } = req.params
  const store = req.query.store || req.user?.store

  try {
    const reservation = await Reservation.findOne({
      where: { id, ...(store ? { store } : {}) }
    })
    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: 'Reservation not found' })
    }
    return res.status(200).json({ success: true, data: reservation })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.create = async (req, res) => {
  const store = req.body.store || req.user?.store
  const {
    customerName,
    customerPhone,
    customerEmail,
    guestCount,
    reservationDate,
    startTime,
    endTime,
    notes,
    tableId
  } = req.body

  try {
    if (!customerName || !reservationDate || !startTime) {
      return res.status(400).json({
        success: false,
        message: 'customerName, reservationDate, and startTime are required'
      })
    }

    if (tableId) {
      const table = await Table.findOne({ where: { id: tableId, store } })
      if (!table) {
        return res
          .status(400)
          .json({ success: false, message: 'Table not found' })
      }
    }

    const reservation = await Reservation.create({
      store,
      tableId: tableId || null,
      customerName,
      customerPhone,
      customerEmail,
      guestCount: guestCount || 1,
      reservationDate,
      startTime,
      endTime: endTime || null,
      notes,
      status: 'pending',
      createdBy: req.user?.id
    })

    createAudit(
      req,
      'create',
      'reservation',
      reservation.id,
      `Created reservation for ${customerName}`
    )

    return res.status(201).json({
      success: true,
      message: 'Reservation created',
      data: reservation
    })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.update = async (req, res) => {
  const { id } = req.params
  const store = req.body.store || req.user?.store
  const {
    customerName,
    customerPhone,
    customerEmail,
    guestCount,
    reservationDate,
    startTime,
    endTime,
    notes,
    status,
    tableId
  } = req.body

  try {
    const reservation = await Reservation.findOne({
      where: { id, ...(store ? { store } : {}) }
    })
    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: 'Reservation not found' })
    }

    if (tableId) {
      const table = await Table.findOne({ where: { id: tableId, store } })
      if (!table) {
        return res
          .status(400)
          .json({ success: false, message: 'Table not found' })
      }
    }

    await reservation.update({
      customerName: customerName ?? reservation.customerName,
      customerPhone: customerPhone ?? reservation.customerPhone,
      customerEmail: customerEmail ?? reservation.customerEmail,
      guestCount: guestCount ?? reservation.guestCount,
      reservationDate: reservationDate ?? reservation.reservationDate,
      startTime: startTime ?? reservation.startTime,
      endTime: endTime ?? reservation.endTime,
      notes: notes ?? reservation.notes,
      status: status ?? reservation.status,
      tableId: tableId !== undefined ? tableId : reservation.tableId,
      modifiedBy: req.user?.id
    })

    createAudit(
      req,
      'update',
      'reservation',
      id,
      `Updated reservation for ${customerName || reservation.customerName}`
    )

    return res.status(200).json({
      success: true,
      message: 'Reservation updated',
      data: reservation
    })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.remove = async (req, res) => {
  const { id } = req.params
  const store = req.body.store || req.user?.store

  try {
    const reservation = await Reservation.findOne({
      where: { id, ...(store ? { store } : {}) }
    })
    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: 'Reservation not found' })
    }

    await reservation.destroy()
    createAudit(req, 'delete', 'reservation', id, `Deleted reservation #${id}`)

    return res
      .status(200)
      .json({ success: true, message: 'Reservation deleted' })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.getAvailableTables = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { date, startTime, endTime } = req.query

  try {
    if (!date || !startTime) {
      return res
        .status(400)
        .json({ success: false, message: 'date and startTime are required' })
    }

    const allTables = await Table.findAll({
      where: { store, status: { [db.Sequelize.Op.ne]: 'maintenance' } }
    })

    const conflictingReservations = await Reservation.findAll({
      where: {
        store,
        reservationDate: date,
        status: ['pending', 'confirmed'],
        [db.Sequelize.Op.or]: endTime
          ? [
              {
                startTime: { [db.Sequelize.Op.lt]: endTime },
                endTime: { [db.Sequelize.Op.gt]: startTime }
              },
              { startTime: { [db.Sequelize.Op.lt]: endTime }, endTime: null }
            ]
          : [
              {
                startTime: {
                  [db.Sequelize.Op.lt]:
                    `${String(Number(startTime.split(':')[0]) + 2).padStart(2, '0')}:00`
                },
                endTime: { [db.Sequelize.Op.gt]: startTime }
              }
            ]
      }
    })

    const reservedTableIds = new Set(
      conflictingReservations.filter((r) => r.tableId).map((r) => r.tableId)
    )
    const available = allTables.filter((t) => !reservedTableIds.has(t.id))

    return res.status(200).json({ success: true, data: available })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}
