const db = require('../../db/models')
const { Op } = db.Sequelize
const ShiftTemplate = db.shift_template
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

exports.getAllShiftTemplate = async (req, res) => {
  try {
    const { store } = req.query
    const where = { status: 'active' }
    if (store) {
      where[Op.or] = [{ store: null }, { store }]
    }

    const templates = await ShiftTemplate.findAll({
      where,
      order: [['name', 'ASC']]
    }).then((res) =>
      res.map((items) => {
        const getData = { ...items.dataValues }
        return getData
      })
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: templates?.length > 0 ? templates : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllShiftTemplateInTable = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all', search } = req.query
    const offset = (page - 1) * limit

    let whereCondition = {}
    if (status && status !== 'all') {
      whereCondition = { status }
    }

    if (search) {
      whereCondition.name = { [Op.iLike]: `%${search}%` }
    }

    const { rows: templates, count: totalItems } =
      await ShiftTemplate.findAndCountAll({
        where: whereCondition,
        offset: parseInt(offset),
        limit: parseInt(limit),
        order: [['updatedAt', 'DESC']]
      })
    await enrichAuditFields(db, templates)

    const totalPages = Math.ceil(totalItems / limit)

    const total = await ShiftTemplate.count()
    const totalActive = await ShiftTemplate.count({ where: { status: 'active' } })
    const totalInactive = await ShiftTemplate.count({ where: { status: 'inactive' } })
    const totalDraft = await ShiftTemplate.count({ where: { status: 'draft' } })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: templates?.length > 0 ? templates : [],
      pagination: {
        totalItems,
        total: totalItems,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      },
      stats: {
        total,
        totalActive,
        totalInactive,
        totalDraft
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

exports.getShiftTemplateById = async (req, res) => {
  try {
    const { id } = req.params

    const template = await ShiftTemplate.findOne({
      where: { id }
    })

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template shift tidak ditemukan'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        ...template.dataValues,
        createdByUser: template.dataValues?.createdByUser || null,
        modifiedByUser: template.dataValues?.modifiedByUser || null
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

exports.addNewShiftTemplate = async (req, res) => {
  const body = req.body

  try {
    const existing = await ShiftTemplate.findOne({
      where: {
        name: body.name,
        store: body.store || null
      }
    })

    if (existing) {
      return res.status(403).json({
        success: false,
        message: 'Template shift dengan nama tersebut sudah ada'
      })
    }

    const template = await ShiftTemplate.create({
      store: body.store || null,
      name: body.name,
      startTime: body.startTime,
      endTime: body.endTime,
      description: body.description || null,
      status:
        body.status !== undefined
          ? body.status === true
            ? 'active'
            : body.status === false
              ? 'inactive'
              : body.status
          : 'active'
    })

    createAudit(
      req,
      'create',
      'shift_template',
      template.id,
      `Created shift template: ${template.name || template.id}`
    )

    return res.status(200).json({
      success: true,
      message: 'Template shift berhasil dibuat',
      data: template
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editShiftTemplateById = async (req, res) => {
  const body = req.body
  const id = req.params.id || body.id

  try {
    const getDuplicate = await ShiftTemplate.findOne({
      where: {
        name: body.name,
        store: body.store || null,
        id: { [Op.ne]: id }
      }
    })

    if (getDuplicate) {
      return res.status(403).json({
        success: false,
        message: 'Template shift dengan nama tersebut sudah ada'
      })
    }

    const template = await ShiftTemplate.findByPk(id)
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template shift tidak ditemukan'
      })
    }

    const [, editRows] = await ShiftTemplate.update(
      {
        store: body.store !== undefined ? body.store : template.store,
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        description: body.description !== undefined ? body.description : template.description,
        status:
          body.status !== undefined
            ? body.status === true
              ? 'active'
              : body.status === false
                ? 'inactive'
                : body.status
            : template.status
      },
      {
        returning: true,
        where: { id }
      }
    )

    const editTemplate = editRows[0]
    createAudit(
      req,
      'update',
      'shift_template',
      id,
      `Updated shift template: ${editTemplate.name || id}`
    )

    return res.status(200).json({
      success: true,
      message: 'Template shift berhasil diperbarui',
      data: editTemplate?.dataValues
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteShiftTemplateById = async (req, res) => {
  const id = req.params.id

  try {
    const template = await ShiftTemplate.findByPk(id)
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template shift tidak ditemukan'
      })
    }

    await ShiftTemplate.destroy({ where: { id } })
    createAudit(
      req,
      'delete',
      'shift_template',
      id,
      `Deleted shift template: ${id}`
    )

    return res.status(200).json({
      success: true,
      message: 'Template shift berhasil dihapus'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
