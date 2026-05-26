const db = require('../../db/models')
const User = db.user
const Location = db.location
const Position = db.position
const Shift = db.shift
const bcrypt = require('bcrypt')
const { Op } = require('sequelize')
const {
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')

exports.addEmployee = async (req, res) => {
  const body = req.body
  const imageFile = req.file

  try {
    if (!body?.password || !body?.userName) {
      return res.status(400).json({
        success: false,
        message: 'User Name dan Password wajib diisi'
      })
    }

    const userName = body?.userName
    const password = body?.password

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          ...(body?.userName ? [{ userName: body.userName }] : []),
          { email: body?.email }
        ]
      }
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar'
      })
    }

    let imageUrl = null
    if (imageFile) {
      const { url, hash } = await uploadToCloudinaryWithDedup(
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

    const role = body?.roleId
      ? await db.role.findByPk(body.roleId)
      : await db.role.findOne({ where: { roleType: 'user' } })

    const employeeId =
      body?.employeeId || String(Math.floor(100000 + Math.random() * 900000))

    const createUser = await User.create({
      image: imageUrl,
      roleType: role?.roleType || 'user',
      roleId: role?.id || null,
      userType: 'user',
      fullName: body?.fullName,
      userName,
      password,
      email: body?.email,
      address: body?.address,
      gender: body?.gender || '',
      phoneNumber: body?.phoneNumber || '',
      employeeID: employeeId,
      department: body?.department,
      employmentType: body?.employmentType,
      startDate: body?.startDate,
      dateOfBirth: body?.dateOfBirth,
      placeOfBirth: body?.placeOfBirth,
      statusEmployee: body?.isActive !== undefined ? body.isActive : true,
      statusActive: body?.isActive !== undefined ? body.isActive : true,
      store: body?.store || null,
      shift: body?.shift || null,
      position: body?.position || null,
      accessMenu: body?.accessMenu || null,
      contractDuration: body?.contractDuration || null,
      endDate: body?.endDate || null
    })

    const result = createUser.toJSON()
    delete result.password

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

    const { page: rawPage = 1, limit: rawLimit = 10 } = req.query
    const page = Math.max(1, parseInt(rawPage) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(rawLimit) || 10))
    const offset = (page - 1) * limit

    const whereCondition = { userType: 'user' }

    if (currentUserRole === 'admin') {
      whereCondition.store = currentUserStore
    }

    const [employees, total, activeCount, locationsResult] = await Promise.all([
      User.findAll({
        where: whereCondition,
        attributes: { exclude: ['password'] },
        include: [
          { model: Location, as: 'storeData', attributes: ['id', 'name'] },
          { model: Position, as: 'positionData', attributes: ['id', 'name'] }
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      }),
      User.count({ where: whereCondition }),
      User.count({ where: { ...whereCondition, statusActive: true } }),
      User.findAll({
        where: { ...whereCondition, store: { [Op.ne]: null } },
        attributes: ['store'],
        group: ['store']
      })
    ])

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: employees,
      pagination: {
        page,
        limit,
        total
      },
      stats: {
        active: activeCount,
        locations: locationsResult.length,
        total
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
        { model: Position, as: 'positionData', attributes: ['id', 'name'] }
      ]
    })

    if (!employee || employee.userType !== 'user') {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan'
      })
    }

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
        { model: Position, as: 'positionData', attributes: ['id', 'name'] }
      ]
    })

    if (!employee || employee.userType !== 'user') {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan'
      })
    }

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
  const imageFile = req.file

  try {
    const employee = await User.findByPk(body?.id)

    if (!employee || employee.userType !== 'user') {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan'
      })
    }

    let imageUrl = employee.image
    if (imageFile) {
      const { url, hash } = await uploadToCloudinaryWithDedup(
        imageFile.path,
        'pos-app-users'
      )
      const duplicate = await User.findOne({
        where: { image: url, id: { [Op.ne]: body.id } }
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

    const updateData = {
      image: imageUrl,
      fullName: body?.fullName ?? employee.fullName,
      userName: body?.userName ?? employee.userName,
      email: body?.email ?? employee.email,
      address: body?.address ?? employee.address,
      gender: body?.gender ?? employee.gender,
      phoneNumber: body?.phoneNumber ?? employee.phoneNumber,
      employeeID: body?.employeeID ?? employee.employeeID,
      department: body?.department ?? employee.department,
      employmentType: body?.employmentType ?? employee.employmentType,
      startDate: body?.startDate ?? employee.startDate,
      dateOfBirth: body?.dateOfBirth ?? employee.dateOfBirth,
      placeOfBirth: body?.placeOfBirth ?? employee.placeOfBirth,
      statusEmployee:
        body?.isActive !== undefined ? body.isActive : employee.statusEmployee,
      statusActive:
        body?.isActive !== undefined ? body.isActive : employee.statusActive,
      store: body?.store ?? employee.store,
      shift: body?.shift ?? employee.shift,
      position: body?.position ?? employee.position,
      accessMenu: body?.accessMenu ?? employee.accessMenu,
      roleId: body?.roleId ?? employee.roleId,
      contractDuration: body?.contractDuration ?? employee.contractDuration,
      endDate: body?.endDate ?? employee.endDate
    }

    if (body?.password) {
      updateData.password = bcrypt.hashSync(body.password, 10)
    }

    if (body?.roleId) {
      const role = await db.role.findByPk(body.roleId)
      if (role) {
        updateData.roleType = role.roleType
      }
    }

    await employee.update(updateData)

    const result = employee.toJSON()
    delete result.password

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

    await User.destroy({ where: { id }, force: true })

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
