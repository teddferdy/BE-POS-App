const { Op } = require('sequelize')
const db = require('../../db/models')
const Notification = db.notification

exports.getAllNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead, store, search } = req.query
    const offset = (page - 1) * limit

    const userRole = req.user?.roleType
    const userStore = req.user?.store

    let whereCondition = {}

    if (store) {
      whereCondition.store = store
    } else if (userRole === 'admin' || userRole === 'user') {
      whereCondition.store = userStore
    }

    if (isRead !== undefined && isRead !== '') {
      whereCondition.isRead = isRead === 'true'
    }

    if (search) {
      whereCondition[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { message: { [Op.iLike]: `%${search}%` } }
      ]
    }

    const { count, rows } = await Notification.findAndCountAll({
      where: whereCondition,
      order: [['updatedAt', 'DESC']],
      offset,
      limit: parseInt(limit),
      include: [{ model: db.location, as: 'storeData', attributes: ['name'] }]
    })

    const data = rows.map((n) => {
      const notif = n.toJSON()
      notif.storeName = notif.storeData?.name || notif.store
      delete notif.storeData
      return notif
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.getUnreadCount = async (req, res) => {
  try {
    const userRole = req.user?.roleType
    const userStore = req.user?.store

    let whereCondition = { isRead: false }
    if (userRole === 'admin' || userRole === 'user') {
      whereCondition.store = userStore
    }

    const count = await Notification.count({ where: whereCondition })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: { unreadCount: count }
    })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params

    const notification = await Notification.findByPk(id)
    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: 'Notification not found' })
    }

    await notification.update({ isRead: true })

    return res
      .status(200)
      .json({ success: true, message: 'Marked as read', data: notification })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.markAllAsRead = async (req, res) => {
  try {
    const userRole = req.user?.roleType
    const userStore = req.user?.store

    let whereCondition = { isRead: false }
    if (userRole === 'admin' || userRole === 'user') {
      whereCondition.store = userStore
    }

    await Notification.update({ isRead: true }, { where: whereCondition })

    return res
      .status(200)
      .json({ success: true, message: 'All notifications marked as read' })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}
