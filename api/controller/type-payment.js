const db = require('../../db/models')
const { Op } = require('sequelize')
const ExcelJS = require('exceljs')
const TypePayment = db.type_payment
const { createAudit } = require('../../utils/auditLog')

// Resolves the store payload sent by the FE (single id, JSON string array, or 'all')
// into a list of store ids to attach rows to. Empty array means global (store null).
const resolveStoreIds = (rawStore, userStore) => {
  let s = rawStore
  if (s === undefined || s === null) s = userStore
  if (s === '' || s === 'all') return []
  let arr = s
  if (typeof s === 'string') {
    try {
      arr = JSON.parse(s)
    } catch {
      arr = [s]
    }
  }
  if (!Array.isArray(arr)) arr = [arr]
  const ids = arr
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)
  return [...new Set(ids)]
}

// Matches store-specific rows plus global (store null) rows for reads.
const buildStoreWhere = (store) => {
  if (!store) return {}
  return { [Op.or]: [{ store }, { store: null }] }
}

exports.getAllTypePaymentByLocationAndActive = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, limit = 10, search } = req.query

  try {
    const offset = (page - 1) * limit

    const where = buildStoreWhere(store)
    if (search) where.name = { [Op.iLike]: `%${search}%` }

    const { rows: typePayment, count } = await TypePayment.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    const [active, draft, inactive] = await Promise.all([
      TypePayment.count({
        where: { ...buildStoreWhere(store), status: 'active' }
      }),
      TypePayment.count({
        where: { ...buildStoreWhere(store), status: 'draft' }
      }),
      TypePayment.count({
        where: { ...buildStoreWhere(store), status: 'inactive' }
      })
    ])

    return res.status(200).json({
      success: true,
      message: 'Success',
      data:
        typePayment?.length > 0
          ? typePayment?.map((items) => {
              return {
                ...items?.dataValues
              }
            })
          : [],
      total: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      stats: { total: active + draft + inactive, active, draft, inactive }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllTypePayment = async (req, res) => {
  const store = req.query.store || req.user?.store
  const {
    page = 1,
    pageSize = req.query.limit || 10,
    status,
    search
  } = req.query

  try {
    const offset = (page - 1) * pageSize

    const queryConditions = buildStoreWhere(store)

    if (status && status !== 'all') {
      queryConditions.status = status
    }

    if (search) queryConditions.name = { [Op.iLike]: `%${search}%` }

    const subCategory = await TypePayment.findAll({
      where: queryConditions,
      limit: parseInt(pageSize),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    })

    const totalTypePayments = await TypePayment.count({
      where: queryConditions
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data:
        subCategory?.length > 0
          ? subCategory?.map((items) => {
              return {
                ...items?.dataValues
              }
            })
          : [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalTypePayments,
        totalPages: Math.ceil(totalTypePayments / pageSize)
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

exports.getTypePaymentById = async (req, res) => {
  try {
    const typePayment = await TypePayment.findByPk(req.params.id)

    if (!typePayment) {
      return res.status(404).json({
        success: false,
        message: 'TypePayment not found'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: typePayment
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.postNewTypePayment = async (req, res) => {
  const { name, type, icon, status } = req.body
  const rawStore = req.body.store ?? req.user?.store
  const stores = resolveStoreIds(rawStore, req.user?.store)
  const statusValue =
    status !== undefined
      ? status === true
        ? 'active'
        : status === false
          ? 'inactive'
          : status
      : 'active'
  try {
    const created = []
    const targets = stores.length > 0 ? stores : [null]
    for (const target of targets) {
      const findOneTypePayment = await TypePayment?.findOne({
        where: {
          name,
          ...(target !== null ? { store: target } : { store: null })
        }
      })
      if (findOneTypePayment) continue
      const postData = await TypePayment.create({
        name,
        store: target,
        type: type || 'cash',
        icon: icon || '',
        status: statusValue
      })
      created.push(postData)
    }

    if (created.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'TypePayment Sudah Terdaftar'
      })
    }

    createAudit(
      req,
      'create',
      'type_payment',
      created[0].id,
      'Created type_payment: ' + (created[0].name || created[0].id)
    )
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: created.length === 1 ? created[0] : created
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editTypePaymentById = async (req, res) => {
  const body = req.body
  const rawStore = body.store ?? req.user?.store
  const stores = resolveStoreIds(rawStore, req.user?.store)
  try {
    const existing = await TypePayment.findByPk(req.params.id)
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'TypePayment not found'
      })
    }
    if (existing?.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Metode pembayaran sistem tidak dapat diedit'
      })
    }
    if (
      req.user?.roleType !== 'super_admin' &&
      existing.store &&
      Number(existing.store) !== Number(req.user?.store)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengedit metode pembayaran ini'
      })
    }

    const targetStore =
      stores.length === 1 ? stores[0] : stores.length > 1 ? existing.store : null
    const getDuplicate = await TypePayment.findOne({
      where: {
        name: body.name,
        ...(targetStore !== null ? { store: targetStore } : { store: null })
      }
    })

    if (!getDuplicate || getDuplicate.id === parseInt(req.params.id)) {
      const editTypePayment = await TypePayment?.update(
        {
          name: body.name,
          ...(targetStore !== undefined && { store: targetStore }),
          type: body.type || existing.type,
          icon: body.icon !== undefined ? body.icon : existing.icon,
          status:
            body.status !== undefined
              ? body.status === true
                ? 'active'
                : body.status === false
                  ? 'inactive'
                  : body.status
              : 'active'
        },
        {
          returning: true,
          where: {
            id: req.params.id
          }
        }
      ).then(([_, data]) => {
        return data
      })
      createAudit(
        req,
        'update',
        'type_payment',
        req.params.id,
        'Updated type_payment: ' + req.params.id
      )

      return res.status(200).json({
        success: true,
        message: 'Sukses Ubah TypePayment',
        data: editTypePayment?.dataValues
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'TypePayment Sudah Tersedia'
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

exports.downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Template Type Payment')

    const headers = ['Name', 'Type', 'Description', 'Status']
    worksheet.addRow(headers)

    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    }

    worksheet.columns = [
      { width: 25 },
      { width: 18 },
      { width: 30 },
      { width: 12 }
    ]

    for (let row = 2; row <= 12; row++) {
      worksheet.getCell(`B${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Tunai,Non-Tunai,Transfer"']
      }
      worksheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Active,Inactive,Draft"']
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=template-type-payment.xlsx'
    )

    return res.status(200).send(buffer)
  } catch (error) {
    console.error('Error =>', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' })
  }
}

exports.downloadData = async (req, res) => {
  try {
    const { store } = req.query
    const where = {}
    if (store) where.store = store

    const typePayments = await TypePayment.findAll({
      where,
      order: [['createdAt', 'ASC']]
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Type Payment Data')

    worksheet.addRow(['ID', 'Name', 'Type', 'Status', 'Created At'])

    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    }

    typePayments.forEach((tp) =>
      worksheet.addRow([
        tp.id,
        tp.name,
        tp.type,
        tp.status === 'active' ? 'Active' : 'Inactive',
        tp.createdAt ? tp.createdAt.toISOString() : ''
      ])
    )

    worksheet.columns = [
      { width: 10 },
      { width: 25 },
      { width: 18 },
      { width: 10 },
      { width: 20 }
    ]

    const buffer = await workbook.xlsx.writeBuffer()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=type-payment-data.xlsx'
    )

    return res.status(200).send(buffer)
  } catch (error) {
    console.error('Error =>', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' })
  }
}

exports.importData = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded' })
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(req.file.buffer)
    const worksheet = workbook.getWorksheet(1)

    const toCreate = []
    const errors = []

    const typeMap = {
      tunai: 'cash',
      'non-tunai': 'other',
      transfer: 'other',
      cash: 'cash',
      debit: 'debit',
      credit: 'credit',
      'e-wallet': 'e-wallet',
      other: 'other'
    }

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return

      try {
        const [name, type, _description, status] = row.values

        if (!name) {
          errors.push(`Row ${rowNumber}: Name is required`)
          return
        }

        const typeKey = type ? String(type).trim().toLowerCase() : ''
        const finalType = typeMap[typeKey] || 'cash'

        const statusValue = status
          ? String(status).toLowerCase() === 'draft'
            ? 'draft'
            : String(status).toLowerCase() === 'active'
              ? 'active'
              : 'inactive'
          : 'active'

        toCreate.push({
          store: req.user?.store,
          name: String(name).trim(),
          type: finalType,
          status: statusValue,
          createdBy: req.user?.id || null
        })
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error.message}`)
      }
    })

    if (errors.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Validation errors', errors })
    }

    const created = []
    const skipped = []
    for (const item of toCreate) {
      const existing = await TypePayment.findOne({
        where: { name: item.name }
      })
      if (existing) {
        skipped.push(item.name)
        continue
      }
      const payment = await TypePayment.create(item)
      created.push(payment)
    }

    createAudit(
      req,
      'import',
      'type_payment',
      null,
      `Imported ${created.length} type payments, skipped ${skipped.length}`
    )

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${created.length} from ${toCreate.length} type payments`,
      data: {
        total: toCreate.length,
        created: created.length,
        skipped: skipped.length,
        skippedNames: skipped.length > 0 ? skipped : undefined
      }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' })
  }
}

exports.deleteTypePaymentById = async (req, res) => {
  const body = req.body

  try {
    const store = body.store || req.user?.store
    const target = await TypePayment.findByPk(req.params.id)
    if (target?.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Metode pembayaran sistem tidak dapat dihapus'
      })
    }
    const getId = await TypePayment.destroy({
      where: {
        id: req.params.id,
        ...(store ? { store } : {})
      }
    })
    createAudit(
      req,
      'delete',
      'type_payment',
      req.params.id,
      'Deleted type_payment: ' + req.params.id
    )

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus TypePayment'
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Hapus TypePayment Gagal'
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
