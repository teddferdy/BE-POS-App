const db = require('../../db/models')
const TypePayment = db.type_payment
const { createAudit } = require('../../utils/auditLog')
const ExcelJS = require('exceljs')

exports.getAllTypePaymentByLocationAndActive = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, limit = 10 } = req.query

  try {
    const offset = (page - 1) * limit

    const { rows: typePayment, count } = await TypePayment.findAndCountAll({
      where: {
        ...(store ? { store } : {})
      },
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    const [active, draft, inactive] = await Promise.all([
      TypePayment.count({ where: { ...(store ? { store } : {}), status: 'active' } }),
      TypePayment.count({ where: { ...(store ? { store } : {}), status: 'draft' } }),
      TypePayment.count({ where: { ...(store ? { store } : {}), status: 'inactive' } })
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
  const { page = 1, pageSize = 10, status } = req.query

  try {
    const offset = (page - 1) * pageSize

    const queryConditions = store ? { store } : {}

    if (status === 'active' || status === 'true') {
      queryConditions.status = 'active'
    } else if (status === 'inactive' || status === 'false') {
      queryConditions.status = 'inactive'
    }

    const subCategory = await TypePayment.findAll({
      where: queryConditions,
      limit: parseInt(pageSize),
      offset: parseInt(offset)
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
  const { name, status } = req.body
  const store = req.body.store || req.user?.store
  try {
    const findOneTypePayment = await TypePayment?.findOne({
      where: {
        name: name,
        ...(store ? { store } : {})
      }
    })

    if (!findOneTypePayment) {
      const postData = await TypePayment.create({
        name: name,
        store: store,
        status:
          status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'inactive'
                : status
            : 'active',
      })
      createAudit(
        req,
        'create',
        'type_payment',
        postData.id,
        'Created type_payment: ' + (postData.name || postData.id)
      )
      return res.status(200).json({
        success: true,
        message: 'Success',
        data: postData
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'TypePayment Sudah Terdaftar'
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

exports.editTypePaymentById = async (req, res) => {
  const body = req.body
  const store = body.store || req.user?.store
  try {
    const existing = await TypePayment.findByPk(req.params.id)
    if (existing?.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Metode pembayaran sistem tidak dapat diedit'
      })
    }
    const getDuplicate = await TypePayment.findOne({
      where: {
        name: body.name,
        ...(store ? { store } : {})
      }
    })

    if (!getDuplicate || getDuplicate.id === parseInt(req.params.id)) {
      const editTypePayment = await TypePayment?.update(
        {
          name: body.name,
          status:
            body.status !== undefined
              ? body.status === true
                ? 'active'
                : body.status === false
                  ? 'inactive'
                  : body.status
              : 'active',
        },
        {
          returning: true,
          where: {
            id: req.params.id,
            ...(store ? { store } : {})
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
      order: [['createdAt', 'DESC']]
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
      'tunai': 'cash',
      'non-tunai': 'other',
      'transfer': 'other',
      'cash': 'cash',
      'debit': 'debit',
      'credit': 'credit',
      'e-wallet': 'e-wallet',
      'other': 'other'
    }

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return

      try {
        const [name, type, description, status] = row.values

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

    const created = await TypePayment.bulkCreate(toCreate)
    createAudit(
      req,
      'import',
      'type_payment',
      null,
      `Imported ${created.length} type payments`
    )

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${created.length} type payments`,
      data: created
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
