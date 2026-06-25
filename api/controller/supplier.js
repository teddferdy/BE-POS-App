const db = require('../../db/models')
const { Op } = require('sequelize')
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')
const ExcelJS = require('exceljs')

const generateOrderNumber = (prefix) => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `${prefix}-${year}${month}${day}-${random}`
}

const supplierController = {
  async getDetail(req, res) {
    try {
      const { id } = req.params

      const supplier = await db.supplier.findByPk(id)

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        })
      }

      const productCount = await db.product.count({
        where: { supplier: id }
      })

      return res.status(200).json({
        success: true,
        message: 'Success get supplier detail',
        data: {
          ...supplier.toJSON(),
          productCount
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getAll(req, res) {
    try {
      const { search, status, page = 1, limit = 10 } = req.query

      const where = {}
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } }
        ]
      }
      if (status !== undefined) {
        // Handle string status values directly (including 'draft')
        if (typeof status === 'string') {
          where.status = status
        } else {
          // Handle boolean status values
          where.status =
            status === true || status === 'true' || status === 'active'
              ? 'active'
              : 'inactive'
        }
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const [suppliers, total, activeCount, inactiveCount, draftCount] = await Promise.all([
        db.supplier.findAll({
          where,
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit),
          offset
        }),
        db.supplier.count({ where }),
        db.supplier.count({ where: { ...where, status: 'active' } }),
        db.supplier.count({ where: { ...where, status: 'inactive' } }),
        db.supplier.count({ where: { ...where, status: 'draft' } })
      ])

      return res.status(200).json({
        success: true,
        message: 'Success get suppliers',
        data: suppliers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        stats: {
          total,
          active: activeCount,
          inactive: inactiveCount,
          draft: draftCount
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const supplier = await db.supplier.findByPk(id)

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get supplier',
        data: supplier
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async create(req, res) {
    try {
      const store = req.user?.store
      const { name, contactPerson, phone, email, address, description, isActive, status } =
        req.body
      const createdBy = req.user?.id || null

      const trimmedName = name?.trim()

      if (!trimmedName && status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const trimmedPhone = phone?.trim()
      if (!trimmedPhone && status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Phone is required'
        })
      }

      if (trimmedPhone) {
        const phoneExists = await db.supplier.findOne({
          where: { phone: trimmedPhone },
          paranoid: false
        })
        if (phoneExists) {
          return res.status(409).json({
            success: false,
            message: 'Nomor supplier sudah terdaftar'
          })
        }
      }

      const existing = await db.supplier.findOne({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: trimmedName } },
            ...(email?.trim() ? [{ email: { [Op.iLike]: email.trim() } }] : [])
          ]
        },
        paranoid: false
      })

      if (existing) {
        const field =
          existing.name.toLowerCase() === trimmedName.toLowerCase()
            ? 'Name'
            : 'Email'
        return res.status(409).json({
          success: false,
          message: `${field} already exists`
        })
      }

      const supplierStatus =
        status !== undefined
          ? status === true
            ? 'active'
            : status === false
              ? 'inactive'
              : status
          : isActive !== undefined
            ? isActive
              ? 'active'
              : 'inactive'
            : 'active'

      const supplier = await db.supplier.create({
        store,
        name: trimmedName,
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        description: description?.trim() || null,
        status: supplierStatus,
        createdBy
      })

      createNotification({
        type: 'supplier_created',
        store,
        referenceId: supplier.id,
        referenceType: 'supplier',
        params: [name],
        createdBy: req.user?.fullName || 'System'
      }).catch(console.error)
      createAudit(
        req,
        'create',
        'supplier',
        supplier.id,
        `Created supplier: ${name}`
      )

      return res.status(201).json({
        success: true,
        message: 'Success create supplier',
        data: supplier
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const store = req.user?.store
      const {
        name,
        contactPerson,
        phone,
        email,
        address,
        description,
        status
      } = req.body
      const modifiedBy = req.user?.id || null

      const supplier = await db.supplier.findByPk(id)

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        })
      }

      const trimmedPhone = phone?.trim()
      if (trimmedPhone) {
        const phoneExists = await db.supplier.findOne({
          where: {
            id: { [Op.ne]: id },
            phone: trimmedPhone
          },
          paranoid: false
        })
        if (phoneExists) {
          return res.status(409).json({
            success: false,
            message: 'Nomor supplier sudah terdaftar'
          })
        }
      }

      const trimmedName = name?.trim()
      if (name && trimmedName) {
        const existing = await db.supplier.findOne({
          where: {
            id: { [Op.ne]: id },
            [Op.or]: [
              { name: { [Op.iLike]: trimmedName } },
              ...(email?.trim() ? [{ email: { [Op.iLike]: email.trim() } }] : [])
            ]
          },
          paranoid: false
        })

        if (existing) {
          const field =
            existing.name.toLowerCase() === trimmedName.toLowerCase()
              ? 'Name'
              : 'Email'
          return res.status(409).json({
            success: false,
            message: `${field} already exists`
          })
        }
      }

      await supplier.update({
        name: trimmedName ?? supplier.name,
        contactPerson:
          contactPerson !== undefined ? contactPerson?.trim() || null : supplier.contactPerson,
        phone: phone !== undefined ? phone?.trim() || null : supplier.phone,
        email: email !== undefined ? email?.trim() || null : supplier.email,
        address: address !== undefined ? address?.trim() || null : supplier.address,
        description:
          description !== undefined ? description?.trim() || null : supplier.description,
        status:
          status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'inactive'
                : status
            : supplier.status,
        modifiedBy
      })

      createNotification({
        type: 'supplier_updated',
        store,
        referenceId: id,
        referenceType: 'supplier',
        params: [name || supplier.name],
        createdBy: req.user?.fullName || 'System'
      }).catch(console.error)
      createAudit(req, 'update', 'supplier', id, `Updated supplier: ${id}`)

      return res.status(200).json({
        success: true,
        message: 'Success update supplier',
        data: supplier
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const store = req.user?.store

      const supplier = await db.supplier.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        })
      }

      await supplier.destroy()

      createNotification({
        type: 'supplier_deleted',
        store,
        referenceId: id,
        referenceType: 'supplier',
        params: [supplier.name],
        createdBy: req.user?.fullName || 'System'
      }).catch(console.error)
      createAudit(
        req,
        'delete',
        'supplier',
        id,
        `Deleted supplier: ${supplier.name}`
      )

      return res.status(200).json({
        success: true,
        message: 'Success delete supplier'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async downloadTemplate(req, res) {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Supplier Template')

      const headers = ['Name', 'Contact Person', 'Phone', 'Email', 'Address', 'Status']
      worksheet.addRow(headers)

      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      worksheet.columns = [
        { width: 25 },
        { width: 22 },
        { width: 20 },
        { width: 30 },
        { width: 30 },
        { width: 12 }
      ]

       for (let row = 2; row <= 12; row++) {
         worksheet.getCell(`F${row}`).dataValidation = {
           type: 'list',
           allowBlank: true,
           formulae: ['"Active,Non-Active,Draft"']
         }
       }

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=supplier-template.xlsx'
      )

      return res.status(200).send(buffer)
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async downloadData(req, res) {
    try {
      const { store } = req.query
      const where = {}
      if (store) where.store = store

      const suppliers = await db.supplier.findAll({
        where,
        order: [['createdAt', 'DESC']]
      })

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Suppliers Data')

      worksheet.addRow([
        'ID',
        'Name',
        'Contact Person',
        'Phone',
        'Email',
        'Address',
        'Status',
        'Created At'
      ])

      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

       suppliers.forEach((s) =>
         worksheet.addRow([
           s.id,
           s.name,
           s.contactPerson || '',
           s.phone,
           s.email,
           s.address,
           s.status === 'active' ? 'Active' : s.status === 'draft' ? 'Draft' : 'Inactive',
           s.createdAt ? s.createdAt.toISOString() : ''
         ])
       )

      worksheet.columns = [
        { width: 10 },
        { width: 25 },
        { width: 22 },
        { width: 20 },
        { width: 30 },
        { width: 30 },
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
        'attachment; filename=suppliers-data.xlsx'
      )

      return res.status(200).send(buffer)
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async importData(req, res) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: 'No file uploaded' })
      }

      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(req.file.buffer)
      const worksheet = workbook.getWorksheet(1)

      const suppliersToCreate = []
      const errors = []

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return

        try {
          const [name, contactPerson, phone, email, address, status] = row.values

          if (!name) {
            errors.push(`Row ${rowNumber}: Name is required`)
            return
          }

          const statusValue = status
            ? String(status).toLowerCase() === 'draft'
              ? 'draft'
              : String(status).toLowerCase() === 'active'
                ? 'active'
                : 'inactive'
            : 'active'

          suppliersToCreate.push({
            store: req.user?.store,
            name: name.trim(),
            contactPerson: contactPerson?.toString().trim() || null,
            phone: phone?.toString().trim() || null,
            email: email?.trim() || null,
            address: address?.trim() || null,
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

      const createdSuppliers = await db.supplier.bulkCreate(suppliersToCreate)
      createAudit(
        req,
        'import',
        'supplier',
        null,
        `Imported ${createdSuppliers.length} suppliers`
      )

      return res.status(201).json({
        success: true,
        message: `Successfully imported ${createdSuppliers.length} suppliers`,
        data: createdSuppliers
      })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = supplierController
