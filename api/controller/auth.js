const db = require('../../db/models')
const User = db.user
const Location = db.location
const Position = db.position
const generateToken = require('../../utils/jwtConvert')
const bcrypt = require('bcrypt')
const moment = require('moment')
const { Op } = require('sequelize')

const parseAccessMenu = (menu) => {
  if (Array.isArray(menu)) return menu
  if (typeof menu === 'string') {
    try { return JSON.parse(menu) } catch (e) { return [] }
  }
  return []
}

const {
  uploadToCloudinary,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const { createAudit } = require('../../utils/auditLog')

// Get User By Location
exports.userByLocation = async (req, res) => {
  const { location } = req.query
  const userRole = req.user?.roleType
  const userStore = req.user?.store

  // Admin and User can only access users in their store
  if (userRole === 'admin' || userRole === 'user') {
    if (location && parseInt(location) !== userStore) {
      return res.status(403).json({
        message: 'Anda hanya dapat mengakses user di toko Anda'
      })
    }
  }

  console.log('Location query parameter:', location)

  try {
    // Fetch users and location data in parallel
    const [users, locationData] = await Promise.all([
      User.findAll({
        where: { store: location },
        attributes: { exclude: ['password'] } // Exclude password in query
      }),
      Location.findOne({
        where: { id: location }
      })
    ])

    // Check if location exists
    if (!locationData) {
      return res.status(404).json({
        message: 'Location not found',
        data: []
      })
    }

    // Fetch all positions
    const positions = await Position.findAll()
    const positionMap = positions.reduce((acc, pos) => {
      acc[pos.id] = pos.name // Map position id to position name
      return acc
    }, {})

    // Add store name and replace position ID with name in user data
    const usersWithStoreName = users.map((user) => ({
      ...user.dataValues,
      storeName: locationData.name,
      positionName: positionMap[user.position] || '' // Map position ID to name
    }))

    res.status(200).json({
      message: 'Success',
      data: usersWithStoreName
    })
  } catch (error) {
    console.error('Error in userByLocation:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  } finally {
    console.log('Request handling completed')
  }
}

// Change User Role By Id & Location
exports.changeUserByIdAndLocation = async (req, res, next) => {
  const { store, id, userType, position, roleId, roleType } = req.body
  const currentUserRole = req.user?.roleType
  const currentUserStore = req.user?.store

  try {
    const targetUser = await User.findByPk(id)

    if (!targetUser) {
      return res.status(404).json({
        message: 'User tidak ditemukan'
      })
    }

    // Validation: Admin can only manage users in their store
    if (currentUserRole === 'admin') {
      if (
        targetUser.store !== currentUserStore &&
        targetUser.roleType !== 'user'
      ) {
        return res.status(403).json({
          message: 'Anda hanya dapat mengubah user di toko Anda'
        })
      }
      // Admin can't change super_admin
      if (targetUser.roleType === 'super_admin') {
        return res.status(403).json({
          message: 'Tidak dapat mengubah Super Admin'
        })
      }
    }

    // Update the userType, position, store, roleId and roleType
    const updateData = { userType, position, store }

    if (roleId || roleType) {
      if (roleId) {
        const role = await db.role.findByPk(roleId)
        if (role) {
          updateData.roleId = roleId
          updateData.roleType = role.roleType
        }
      } else if (roleType) {
        updateData.roleType = roleType
        // Clear roleId if changing to custom or different type
        updateData.roleId = null
      }
    }

    const [affectedRows, updatedUsers] = await User.update(updateData, {
      returning: true,
      where: { id }
    })

    if (affectedRows === 0) {
      return res.status(404).json({
        message: 'User not found or no changes made.'
      })
    }

    const result = updatedUsers[0]?.dataValues
    delete result.password
    createAudit(req, 'update', 'user', id, `Updated user role: ${id}`)

    return res.status(200).json({
      message: 'User role updated successfully',
      data: result
    })
  } catch (error) {
    console.error('Error updating user role:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

// Get All List User
exports.getAllUser = async (req, res, next) => {
  try {
    const currentUserRole = req.user?.roleType
    const currentUserStore = req.user?.store

    const whereCondition = {}

    // Admin can only see users in their store
    if (currentUserRole === 'admin') {
      whereCondition.store = currentUserStore
      whereCondition.roleType = { [Op.ne]: 'super_admin' }
    }

    const getAllUser = await User.findAll({
      where: whereCondition
    }).then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        delete getData.password
        return getData
      })
    )

    res.status(200).json({
      message: 'Success',
      data: getAllUser.length > 0 ? getAllUser : []
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.login = async (req, res) => {
  const { userName, password } = req.body

  if (!userName || !password) {
    return res
      .status(400)
      .json({ message: 'Username dan Password harus diisi' })
  }

  try {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userName)

    // Cari user berdasarkan email atau username
    const findUser = await User.findOne({
      where: isEmail
        ? { email: userName.toLowerCase() }
        : { userName: userName.toLowerCase() },
      paranoid: false // opsional untuk test
    })

    console.log('findUser =>', findUser?.dataValues || null)

    if (!findUser) {
      return res.status(401).json({
        message: 'User Name / Email Tidak Ditemukan'
      })
    }

    // Cocokkan password
    const isPasswordValid = await bcrypt.compare(password, findUser.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Password Salah'
      })
    }

    // Update status active
    await User.update(
      { statusActive: true },
      {
        where: { id: findUser.id }
      }
    )

    // Generate token dengan role info
    const getToken = generateToken({
      id: findUser.id,
      roleType: findUser.roleType || 'user',
      roleId: findUser.roleId,
      store: findUser.store
    })

    // Ambil role dan accessMenu
    let roleData = null
    let accessMenu = findUser.accessMenu

    if (findUser.roleId) {
      roleData = await db.role.findByPk(findUser.roleId)
      if (roleData && !accessMenu) {
        accessMenu = roleData.accessMenu
      }
    }

    // Jika userType bukan admin/user
    if (!['admin', 'user'].includes(findUser.userType)) {
      return res.status(200).json({
        message: 'Success Login',
        token: getToken,
        user: {
          ...findUser.toJSON(),
          roleType: findUser.roleType || 'user',
          roleName: roleData?.name || 'Staff/Karyawan',
          accessMenu: parseAccessMenu(accessMenu)
        }
      })
    }

    // Ambil data tambahan
    const location = await Location.findOne({ where: { id: findUser.store } })
    const position = await Position.findOne({
      where: { id: findUser.position }
    })

    return res.status(200).json({
      message: 'Success Login',
      token: getToken,
      user: {
        ...findUser.toJSON(),
        roleType: findUser.roleType || 'user',
        roleName: roleData?.name || 'Staff/Karyawan',
        accessMenu: parseAccessMenu(accessMenu),
        storeName: location?.name ?? '',
        positionName: position?.name ?? ''
      }
    })
  } catch (error) {
    console.error('ERROR LOGIN =>', error)
    return res.status(500).json({
      message: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
  }
}

// Register
exports.registerNewUser = async (req, res, next) => {
  const body = req.body
  console.log('BODY =>', body)

  try {
    // Validate userType
    if (!['admin', 'user'].includes(body?.userType)) {
      return res.status(400).json({
        message: 'Gagal Menyimpan User - Tipe Pengguna Salah'
      })
    }

    // Ensure password and confirmPassword match
    if (body?.password !== body?.confirmPassword) {
      return res.status(400).json({
        message: 'Password dan Konfirmasi Password Tidak Cocok'
      })
    }

    // Check if the user (either by email or userName) already exists
    const findUser = await User.findOne({
      where: {
        [Op.or]: [{ userName: body?.userName }, { email: body?.email }]
      }
    })

    if (!findUser) {
      const employeeID = String(Math.floor(100000 + Math.random() * 900000))

      // Provide default values for fields that may be null
      const shift = body?.shift !== undefined ? body.shift : 0 // Set to 0 or a default valid value
      const position = body?.position !== undefined ? body.position : 0 // Set to 0 or a default valid value

      // Get default role (Staff/Karyawan) - roleType 'user'
      const defaultRole = await db.role.findOne({
        where: { roleType: 'user' }
      })

      // Create new user in the database
      const hashedPassword = bcrypt.hashSync(body?.password, 10)
      const createUser = await User.create({
        roleType: 'user', // Default role is user
        roleId: defaultRole?.id || null, // Assign default role ID
        userType: body.userType || 'user', // Use the provided userType, default to 'user'
        userName: body?.userName,
        password: hashedPassword,
        email: body?.email,
        address: body.address,
        employeeID: employeeID, // Assign generated Employee ID
        fullName: body?.fullName || '',
        phoneNumber: body?.phoneNumber || '',
        gender: body?.gender || '',
        dateOfBirth: body?.dateOfBirth || null,
        placeOfBirth: body?.placeOfBirth || '',
        store: body.store || null, // Store ID should not be null, ensure FE sends it
        shift: shift, // Assign default value if undefined
        position: position, // Assign default value if undefined
        accessMenu: body?.accessMenu ? parseAccessMenu(body.accessMenu) : null,
        statusEmployee: true,
        statusActive: true,
        modifiedAt: moment().format('YYYY-MM-DD HH:mm:ss')
      })
      createAudit(req, 'create', 'user', createUser.id, `Created user: ${createUser.userName || createUser.id}`)

      const result = createUser.toJSON()
      delete result.password // Remove the password before sending it back

      // Generate token
      result.token = generateToken({ id: result?.id })

      console.log('RESULT =>', result)

      return res.status(200).json({
        message: 'Success Menyimpan User',
        data: result
      })
    } else {
      return res.status(401).json({
        message: 'Email / Username Sudah Terdaftar'
      })
    }
  } catch (error) {
    console.log('ERROR REGISTER =>', error)

    return res.status(500).json({
      message: 'Terjadi Kesalahan Internal Server',
      error: error.message
    })
  }
}

// Edit User
exports.editUser = async (req, res, next) => {
  try {
    const { body } = req
    const imageFile = req.file
    const existingUser = await User.findOne({
      where: { email: body.email, id: body.id }
    })

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    let image = existingUser.image

    if (imageFile) {
      const uploadedImage = await uploadToCloudinary(
        imageFile.path,
        'pos-app-users'
      )

      if (existingUser.image) {
        await deleteFromCloudinary(existingUser.image)
      }
      image = uploadedImage
    }

    const updatedUser = await existingUser.update({
      userName: body.userName,
      fullName: body.fullName || existingUser.fullName,
      address: body.address,
      gender: body.gender,
      phoneNumber: body.phoneNumber,
      dateOfBirth: body.dateOfBirth ? body.dateOfBirth : null,
      placeOfBirth: body.placeOfBirth || existingUser.placeOfBirth,
      image: image,
      deletedAt: null
    })
    createAudit(req, 'update', 'user', updatedUser.id, `Updated user: ${updatedUser.id}`)

    const token = generateToken({ id: updatedUser.id })

    const locationByIdUserLogin = await Location.findOne({
      where: {
        id: updatedUser.dataValues.store
      }
    })

    const positionByIdUserLogin = await Position.findOne({
      where: {
        id: updatedUser.dataValues.position
      }
    })

    return res.status(200).json({
      message: 'Success Login',
      token: token,
      user: {
        ...updatedUser?.dataValues,
        storeName: locationByIdUserLogin?.dataValues?.name ?? '',
        positionName: positionByIdUserLogin?.dataValues?.name ?? ''
      }
    })
  } catch (error) {
    console.error('ERROR:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

// Reset Password
exports.resetPassword = async (req, res, next) => {
  const body = req?.body
  console.log('BODY', body)

  const data = await User.findAll()
  console.log('data =>', data)

  if (!body?.userName || !body?.password) {
    return res.status(400).json({
      error: 'Username dan Password tidak boleh kosong'
    })
  }

  try {
    const usernameLower = body.userName.toLowerCase()

    const existingUser = await User.findOne({
      where: { userName: usernameLower }
    })

    if (!existingUser) {
      return res.status(404).json({
        error: 'User tidak ditemukan'
      })
    }

    await User.update(
      {
        password: bcrypt.hashSync(body.password, 10)
      },
      {
        where: {
          userName: usernameLower
        }
      }
    )

    const findUser = await User.findOne({
      where: {
        userName: usernameLower
      }
    })

    console.log('FIND USER =>', findUser)

    if (findUser?.dataValues) {
      const result = findUser.toJSON()

      result.token = generateToken({
        id: result?.id
      })

      return res.status(200).json({
        message: 'Success Mereset Password User',
        data: result
      })
    } else {
      return res.status(401).json({
        error: 'Gagal Mereset Password'
      })
    }
  } catch (error) {
    console.log('ERROR =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Generate Employee ID
exports.generateEmployeeId = async (req, res) => {
  try {
    const employeeId = String(Math.floor(100000 + Math.random() * 900000))

    return res.status(200).json({
      success: true,
      data: { employeeId }
    })
  } catch (error) {
    console.error('Error generate employee ID:', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// User Logout
exports.logout = async (req, res, next) => {
  try {
    const body = req.body
    const bodyUserNameOrEmail = body?.userName || body?.email
    const storeId = body?.store // Store identifier passed from FE

    if (!bodyUserNameOrEmail || !storeId) {
      return res.status(400).json({
        message: 'User Name / Email & Store ID Tidak Boleh Kosong'
      })
    }

    // Check if the input is an email or username using a regex
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bodyUserNameOrEmail)

    // Find user by email or userName and store ID
    const findUser = isEmail
      ? await User.findOne({
          where: {
            email: bodyUserNameOrEmail,
            store: storeId // Ensure it matches the store
          }
        })
      : await User.findOne({
          where: {
            userName: bodyUserNameOrEmail,
            store: storeId
          }
        })

    // If user is found, update status to inactive
    if (findUser) {
      await User.update(
        { statusActive: false }, // Set status to inactive
        {
          where: isEmail
            ? { email: bodyUserNameOrEmail, store: storeId }
            : { userName: bodyUserNameOrEmail, store: storeId }
        }
      )

      // Clear the token cookie
      res.clearCookie('token')

      return res.status(200).json({
        message: 'User Berhasil Logout'
      })
    } else {
      return res.status(404).json({
        message: 'User Tidak Ditemukan'
      })
    }
  } catch (error) {
    console.log('ERROR LOGOUT =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
