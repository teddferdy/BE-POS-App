const db = require('../db/models')
const { emitNotification } = require('../api/service/socket')

const notificationTypes = {
  employee_created: {
    title: 'New Employee Added',
    description: (name) => `Employee ${name} has been added.`
  },
  employee_updated: {
    title: 'Employee Updated',
    description: (name) => `Employee ${name} has been updated.`
  },
  employee_deleted: {
    title: 'Employee Deleted',
    description: (name) => `Employee ${name} has been removed.`
  },
  location_created: {
    title: 'New Store Added',
    description: (name) => `Store "${name}" has been created.`
  },
  location_updated: {
    title: 'Store Updated',
    description: (name) => `Store "${name}" has been updated.`
  },
  location_deleted: {
    title: 'Store Deleted',
    description: (name) => `Store "${name}" has been removed.`
  },
  product_created: {
    title: 'New Product Added',
    description: (name) => `Product "${name}" has been added.`
  },
  product_updated: {
    title: 'Product Updated',
    description: (name) => `Product "${name}" has been updated.`
  },
  product_deleted: {
    title: 'Product Deleted',
    description: (name) => `Product "${name}" has been removed.`
  },
  category_created: {
    title: 'New Category Added',
    description: (name) => `Category "${name}" has been added.`
  },
  category_updated: {
    title: 'Category Updated',
    description: (name) => `Category "${name}" has been updated.`
  },
  category_deleted: {
    title: 'Category Deleted',
    description: (name) => `Category "${name}" has been removed.`
  },
  supplier_created: {
    title: 'New Supplier Added',
    description: (name) => `Supplier "${name}" has been added.`
  },
  supplier_updated: {
    title: 'Supplier Updated',
    description: (name) => `Supplier "${name}" has been updated.`
  },
  supplier_deleted: {
    title: 'Supplier Deleted',
    description: (name) => `Supplier "${name}" has been removed.`
  },
  order_created: {
    title: 'New Order',
    description: (orderNumber) => `Order #${orderNumber} has been created.`
  },
  payment_received: {
    title: 'Payment Received',
    description: (orderNumber, amount) =>
      `Payment of ${amount} for order #${orderNumber} has been received.`
  },
  low_stock: {
    title: 'Low Stock Alert',
    description: (name, stock) =>
      `Product "${name}" is running low (${stock} left).`
  },
  stock_opname_created: {
    title: 'Stock Opname Created',
    description: (name) => `Stock opname "${name}" has been created.`
  },
  expense_created: {
    title: 'New Expense',
    description: (amount) => `Expense of ${amount} has been recorded.`
  },
  member_created: {
    title: 'New Member',
    description: (name) => `Member "${name}" has been registered.`
  },
  shift_created: {
    title: 'Shift Created',
    description: (name) => `Shift "${name}" has been created.`
  },
  discount_created: {
    title: 'New Discount',
    description: (name) => `Discount "${name}" has been created.`
  },
  shift_swap_requested: {
    title: 'Permintaan Tukar Shift',
    description: (requesterName, targetName, date) =>
      `${requesterName || 'Seseorang'} ingin bertukar shift dengan ${
        targetName || 'rekan kerja'
      }${date ? ` pada ${date}` : ''}.`
  },
  shift_swap_approved: {
    title: 'Pertukaran Shift Disetujui',
    description: (requesterName, targetName) =>
      `Pertukaran shift antara ${requesterName || 'Kamu'} dan ${
        targetName || 'rekan kerja'
      } telah disetujui.`
  },
  shift_swap_rejected: {
    title: 'Pertukaran Shift Ditolak',
    description: (requesterName, targetName) =>
      `Permintaan pertukaran shift antara ${requesterName || 'Kamu'} dan ${
        targetName || 'rekan kerja'
      } telah ditolak.`
  },
  shift_swap_cancelled: {
    title: 'Pertukaran Shift Dibatalkan',
    description: (requesterName, targetName) =>
      `Permintaan pertukaran shift antara ${requesterName || 'Kamu'} dan ${
        targetName || 'rekan kerja'
      } telah dibatalkan.`
  },
  shift_swap_expired: {
    title: 'Pertukaran Shift Kedaluwarsa',
    description: (requesterName, targetName) =>
      `Permintaan pertukaran shift antara ${requesterName || 'Kamu'} dan ${
        targetName || 'rekan kerja'
      } kedaluwarsa karena tanggal shift sudah lewat.`
  },
  overtime_requested: {
    title: 'Pengajuan Lembur Baru',
    description: (employeeName, date, duration) =>
      `${employeeName || 'Karyawan'} mengajukan lembur ${date || ''}${duration ? ` selama ${duration} jam` : ''}.`
  },
  overtime_approved: {
    title: 'Lembur Disetujui',
    description: (employeeName, date, note) =>
      `Lembur ${employeeName || 'Kamu'} pada ${date || ''} telah disetujui${note ? `. Catatan: ${note}` : '.'}`
  },
  overtime_rejected: {
    title: 'Lembur Ditolak',
    description: (employeeName, date, note) =>
      `Lembur ${employeeName || 'Kamu'} pada ${date || ''} ditolak${note ? `. Catatan: ${note}` : '.'}`
  }
}

const createNotification = async ({
  type,
  store,
  referenceId,
  referenceType,
  params = [],
  createdBy
}) => {
  try {
    const config = notificationTypes[type]
    if (!config) return null

    const title = config.title
    const description =
      typeof config.description === 'function'
        ? config.description(...params)
        : config.description

    const notification = await db.notification.create({
      store: store || null,
      type,
      title,
      description,
      referenceId,
      referenceType,
      createdBy
    })

    if (store) {
      emitNotification(store, notification)
    }

    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

module.exports = { createNotification, notificationTypes }
