const crypto = require('crypto')
const db = require('../../db/models')
const User = db.user
const Location = db.location
const Position = db.position
const Department = db.department
const { Op } = require('sequelize')
const {
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

const parseAccessMenu = (menu) => {
  if (Array.isArray(menu)) return menu
  if (typeof menu === 'string') {
    try {
      return JSON.parse(menu)
    } catch {
      return []
    }
  }
  return []
}

exports.addEmployee = async (req, res) => {
  const body = req.body
  const imageFile = req.files?.['image']?.[0]
  const documentFiles = req.files?.['documents'] || []

  try {
    if (body?.status !== 'draft' && (!body?.password || !body?.userName)) {
      return res.status(400).json({
        success: false,
        message: 'User Name dan Password wajib diisi'
      })
    }

    const userName = body?.userName || null
    const password = body?.password || null

    const existingUser = await User.findOne({
      paranoid: false,
      where: {
        [Op.or]: [
          ...(body?.userName ? [{ userName: body.userName }] : []),
          ...(body?.email ? [{ email: body.email }] : [])
        ]
      }
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username atau Email sudah terdaftar'
      })
    }

    if (body?.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        return res.status(400).json({
          success: false,
          message: 'Format email tidak valid'
        })
      }
    }

    const employeeID = body?.employeeID || body?.employeeId
    if (employeeID) {
      const existingEmployeeID = await User.findOne({
        where: { employeeID }
      })
      if (existingEmployeeID) {
        return res.status(409).json({
          success: false,
          message: 'Employee ID sudah digunakan'
        })
      }
    }

    if (body?.phoneNumber) {
      const existingPhone = await User.findOne({
        where: { phoneNumber: body.phoneNumber }
      })
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: 'Nomor telepon sudah digunakan'
        })
      }
    }

    let imageUrl = null
    if (imageFile) {
      const { url } = await uploadToCloudinaryWithDedup(
        imageFile.path,
        'pos-app-users'
      )
      const duplicate = await User.findOne({
        where: { image: url }
      })
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Gambar sudah digunakan oleh karyawan lain'
        })
      }
      imageUrl = url
    }

    let documentUrls = []
    if (documentFiles.length > 0) {
      for (const doc of documentFiles) {
        const { url } = await uploadToCloudinaryWithDedup(
          doc.path,
          'pos-app-documents'
        )
        documentUrls.push(url)
      }
    }

    const role = body?.roleId
      ? await db.role.findByPk(body.roleId)
      : await db.role.findOne({ where: { roleType: 'user' } })

    const employeeId =
      body?.employeeID ||
      body?.employeeId ||
      String(crypto.randomInt(100000, 999999))

    const isDraft = (body?.status || 'active') === 'draft'
    const draftSuffix = isDraft ? `draft-${employeeId}` : null

    const createUser = await User.create({
      image: imageUrl,
      roleType: role?.roleType || 'user',
      roleId: role?.id || null,
      userType: 'user',
      fullName: body?.fullName || draftSuffix || '',
      userName: userName || draftSuffix || '',
      password: password || (isDraft ? 'Draft!12345' : ''),
      email: body?.email || (isDraft ? `${draftSuffix}@placeholder.local` : ''),
      address: body?.address || '',
      gender: body?.gender || '',
      phoneNumber: body?.phoneNumber || '',
      employeeID: employeeId,
      department: body?.department || '',
      departmentId: body?.departmentId || null,
      employmentType: body?.employmentType || '',
      startDate: body?.startDate || null,
      dateOfBirth: body?.dateOfBirth || null,
      placeOfBirth: body?.placeOfBirth || '',
      status: isDraft ? 'draft' : body?.status || 'active',
      store: body?.store || null,
      shift: body?.shift || null,
      position: body?.position || null,
      accessMenu: body?.accessMenu ? parseAccessMenu(body.accessMenu) : null,
      contractDuration: body?.contractDuration || null,
      endDate: body?.endDate || null,
      monthlySalary: body?.monthlySalary || null,
      dailySalary: body?.dailySalary || null,
      documents: documentUrls.length > 0 ? JSON.stringify(documentUrls) : null,
      createdBy: req.user?.id || null
    })

    createAudit(
      req,
      'create',
      'employee',
      createUser.id,
      `Created employee: ${createUser.id}`
    )

    const result = createUser.toJSON()
    delete result.password

    createNotification({
      type: 'employee_created',
      store: createUser.store,
      referenceId: createUser.id,
      referenceType: 'employee',
      params: [req.body.fullName],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)

    return res.status(200).json({
      success: true,
      message: 'Karyawan berhasil ditambahkan',
      data: result
    })
  } catch (error) {
    console.error('Error add employee:', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllEmployee = async (req, res) => {
  try {
    const currentUserRole = req.user?.roleType
    const currentUserStore = req.user?.store

    const {
      page: rawPage = 1,
      limit: rawLimit = 10,
      search,
      status
    } = req.query
    const page = Math.max(1, parseInt(rawPage) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(rawLimit) || 10))
    const offset = (page - 1) * limit

    const whereCondition = { userType: 'user' }

    if (status) {
      whereCondition.status = status
    }

    if (search) {
      whereCondition[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { userName: { [Op.iLike]: `%${search}%` } }
      ]
    }

    if (currentUserRole === 'admin') {
      whereCondition.store = currentUserStore
    }

    const [employees, total, activeCount, inactiveCount, draftCount] =
      await Promise.all([
        User.findAll({
          where: whereCondition,
          attributes: { exclude: ['password'] },
          include: [
            { model: Location, as: 'storeData', attributes: ['id', 'name'] },
            { model: Position, as: 'positionData', attributes: ['id', 'name'] },
            {
              model: Department,
              as: 'departmentData',
              attributes: ['id', 'name']
            }
          ],
          limit,
          offset,
          order: [['createdAt', 'DESC']]
        }),
        User.count({ where: whereCondition }),
        User.count({ where: { ...whereCondition, status: 'active' } }),
        User.count({ where: { ...whereCondition, status: 'inactive' } }),
        User.count({ where: { ...whereCondition, status: 'draft' } }),
        User.findAll({
          where: { ...whereCondition, store: { [Op.ne]: null } },
          attributes: ['store'],
          group: ['store']
        })
      ])

    const totalPages = Math.ceil(total / limit)

    await enrichAuditFields(db, employees)

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: employees,
      total,
      pagination: {
        total,
        totalPages,
        page,
        limit
      },
      stats: {
        total,
        active: activeCount,
        draft: draftCount,
        inactive: inactiveCount
      }
    })
  } catch (error) {
    console.error('Error get all employee:', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getEmployeeById = async (req, res) => {
  const { id } = req.params

  try {
    const employee = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Location, as: 'storeData', attributes: ['id', 'name'] },
        { model: Position, as: 'positionData', attributes: ['id', 'name'] },
        { model: Department, as: 'departmentData', attributes: ['id', 'name'] }
      ]
    })

    if (!employee || employee.userType !== 'user') {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan'
      })
    }

    await enrichAuditFields(db, [employee])

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: employee
    })
  } catch (error) {
    console.error('Error get employee by id:', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getEmployeeByEmployeeID = async (req, res) => {
  const { employeeID } = req.params

  try {
    const employee = await User.findOne({
      where: { employeeID },
      attributes: { exclude: ['password'] },
      include: [
        { model: Location, as: 'storeData', attributes: ['id', 'name'] },
        { model: Position, as: 'positionData', attributes: ['id', 'name'] },
        { model: Department, as: 'departmentData', attributes: ['id', 'name'] }
      ]
    })

    if (!employee || employee.userType !== 'user') {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan'
      })
    }

    await enrichAuditFields(db, [employee])

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: employee
    })
  } catch (error) {
    console.error('Error get employee by employeeID:', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.updateEmployee = async (req, res) => {
  const body = req.body
  const imageFile = req.files?.['image']?.[0]
  const documentFiles = req.files?.['documents'] || []

  try {
    const employeeId = req.body.id || req.query.id || req.params.id
    const employee = await User.findByPk(employeeId)

    if (!employee || employee.userType !== 'user') {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan'
      })
    }

    if (body?.userName && body.userName !== employee.userName) {
      const existing = await User.findOne({
        where: { userName: body.userName, id: { [Op.ne]: employeeId } }
      })
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Username sudah digunakan'
        })
      }
    }

    if (body?.email && body.email !== employee.email) {
      const existing = await User.findOne({
        where: { email: body.email, id: { [Op.ne]: employeeId } }
      })
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Email sudah digunakan'
        })
      }
    }

    if (body?.employeeID && body.employeeID !== employee.employeeID) {
      const existing = await User.findOne({
        where: { employeeID: body.employeeID, id: { [Op.ne]: employeeId } }
      })
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Employee ID sudah digunakan'
        })
      }
    }

    const updateEmployeeID =
      body?.employeeID || body?.employeeId || employee.employeeID

    if (body?.phoneNumber && body.phoneNumber !== employee.phoneNumber) {
      const existing = await User.findOne({
        where: { phoneNumber: body.phoneNumber, id: { [Op.ne]: employeeId } }
      })
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Nomor telepon sudah digunakan'
        })
      }
    }

    let imageUrl = employee.image
    if (imageFile) {
      const { url } = await uploadToCloudinaryWithDedup(
        imageFile.path,
        'pos-app-users'
      )
      const duplicate = await User.findOne({
        where: { image: url, id: { [Op.ne]: employeeId } }
      })
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Gambar sudah digunakan oleh karyawan lain'
        })
      }
      if (employee.image && employee.image !== url) {
        await deleteFromCloudinary(employee.image)
      }
      imageUrl = url
    }

    let documentUrls = employee.documents ? JSON.parse(employee.documents) : []

    const deletedDocuments = body?.deletedDocuments
      ? typeof body.deletedDocuments === 'string'
        ? JSON.parse(body.deletedDocuments)
        : body.deletedDocuments
      : []

    if (deletedDocuments.length > 0) {
      for (const docUrl of deletedDocuments) {
        await deleteFromCloudinary(docUrl)
      }
      documentUrls = documentUrls.filter(
        (url) => !deletedDocuments.includes(url)
      )
    }

    if (documentFiles.length > 0) {
      for (const doc of documentFiles) {
        const { url } = await uploadToCloudinaryWithDedup(
          doc.path,
          'pos-app-documents'
        )
        documentUrls.push(url)
      }
    }

    const updateData = {
      image: imageUrl,
      fullName: body?.fullName ?? employee.fullName,
      userName: body?.userName ?? employee.userName,
      email: body?.email ?? employee.email,
      address: body?.address ?? employee.address,
      gender: body?.gender ?? employee.gender,
      phoneNumber: body?.phoneNumber ?? employee.phoneNumber,
      employeeID: updateEmployeeID ?? employee.employeeID,
      department: body?.department ?? employee.department,
      departmentId: body?.departmentId ?? employee.departmentId,
      employmentType: body?.employmentType ?? employee.employmentType,
      startDate: body?.startDate ?? employee.startDate,
      dateOfBirth: body?.dateOfBirth ?? employee.dateOfBirth,
      placeOfBirth: body?.placeOfBirth ?? employee.placeOfBirth,
      status:
        body?.status ||
        (body?.isActive !== undefined
          ? body.isActive
            ? 'active'
            : 'inactive'
          : employee.status),
      store: body?.store ?? employee.store,
      shift: body?.shift ?? employee.shift,
      position: body?.position ?? employee.position,
      accessMenu: body?.accessMenu
        ? parseAccessMenu(body.accessMenu)
        : employee.accessMenu,
      roleId: body?.roleId ?? employee.roleId,
      contractDuration: body?.contractDuration ?? employee.contractDuration,
      endDate: body?.endDate ?? employee.endDate,
      monthlySalary: body?.monthlySalary ?? employee.monthlySalary,
      dailySalary: body?.dailySalary ?? employee.dailySalary,
      documents:
        deletedDocuments.length > 0 || documentFiles.length > 0
          ? JSON.stringify(documentUrls)
          : employee.documents,
      modifiedBy: req.user?.id || null
    }

    if (body?.password) {
      updateData.password = body.password
    }

    if (body?.roleId) {
      const role = await db.role.findByPk(body.roleId)
      if (role) {
        updateData.roleType = role.roleType
      }
    }

    await employee.update(updateData)

    createAudit(
      req,
      'update',
      'employee',
      employeeId,
      `Updated employee: ${employeeId}`
    )

    const result = employee.toJSON()
    delete result.password

    createNotification({
      type: 'employee_updated',
      store: employee.store,
      referenceId: employee.id,
      referenceType: 'employee',
      params: [req.body.fullName || employee.fullName],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)

    return res.status(200).json({
      success: true,
      message: 'Karyawan berhasil diupdate',
      data: result
    })
  } catch (error) {
    console.error('Error update employee:', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteEmployee = async (req, res) => {
  const { id } = req.params

  try {
    const employee = await User.findByPk(id)

    if (!employee || employee.userType !== 'user') {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan'
      })
    }

    if (employee.image) {
      await deleteFromCloudinary(employee.image)
    }

    await User.destroy({ where: { id } })

    createAudit(req, 'delete', 'employee', id, `Deleted employee: ${id}`)

    createNotification({
      type: 'employee_deleted',
      store: employee.store,
      referenceId: employee.id,
      referenceType: 'employee',
      params: [employee.fullName || 'Unknown'],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)

    return res.status(200).json({
      success: true,
      message: 'Karyawan berhasil dihapus'
    })
  } catch (error) {
    console.error('Error delete employee:', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
