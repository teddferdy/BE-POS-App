const db = require('../../db/models')
const User = db.user
const Location = db.location
const Position = db.position
const generateToken = require('../../utils/jwtConvert')
const bcrypt = require('bcrypt')
const moment = require('moment')
const crypto = require('crypto')
const { Op } = require('sequelize')

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

const {
  uploadToCloudinary,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const { createAudit } = require('../../utils/auditLog')
const {
  sendEmail,
  buildResetPasswordEmail
} = require('../../utils/emailService')

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
        where: location ? { store: location } : {},
        attributes: { exclude: ['password'] } // Exclude password in query
      }),
      Location.findOne({
        where: location ? { id: location } : {}
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

// Change User Status (activate/deactivate) By Id
exports.changeUserStatusById = async (req, res) => {
  const { id, status } = req.body
  const currentUserRole = req.user?.roleType
  const currentUserStore = req.user?.store

  try {
    if (!id) {
      return res.status(400).json({
        message: 'ID User wajib diisi'
      })
    }
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        message: 'Status harus active atau inactive'
      })
    }

    const targetUser = await User.findByPk(id)

    if (!targetUser) {
      return res.status(404).json({
        message: 'User tidak ditemukan'
      })
    }

    if (currentUserRole === 'admin') {
      if (
        targetUser.store !== currentUserStore &&
        targetUser.roleType !== 'user'
      ) {
        return res.status(403).json({
          message: 'Anda hanya dapat mengubah user di toko Anda'
        })
      }
      if (targetUser.roleType === 'super_admin') {
        return res.status(403).json({
          message: 'Tidak dapat mengubah Super Admin'
        })
      }
    }

    const updatedUser = await User.update(
      { status },
      {
        returning: true,
        where: { id }
      }
    )

    if (updatedUser[0] === 0) {
      return res.status(404).json({
        message: 'User not found or no changes made.'
      })
    }

    createAudit(req, 'update', 'user', id, `Updated user status: ${id}`)

    const result = updatedUser[1][0]?.dataValues
    if (result) {
      delete result.password
    }

    return res.status(200).json({
      message: 'Status user berhasil diubah',
      data: result
    })
  } catch (error) {
    console.error('Error updating user status:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

// Change User Role By Id & Location
exports.changeUserByIdAndLocation = async (req, res) => {
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
exports.getAllUser = async (req, res) => {
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
  } catch {
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
      { status: 'active' },
      {
        where: { id: findUser.id }
      }
    )

    // Generate token dengan role info
    const getToken = generateToken({
      id: findUser.id,
      userName: findUser.userName,
      fullName: findUser.fullName,
      roleType: findUser.roleType || 'user',
      roleId: findUser.roleId,
      store: findUser.store
    })

    // Ambil role dan accessMenu
    let roleData = null
    let accessMenu = findUser.accessMenu

    if (findUser.roleId) {
      roleData = await db.role.findByPk(findUser.roleId)
      if (roleData && (!accessMenu || !accessMenu.length)) {
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
exports.registerNewUser = async (req, res) => {
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

      // Create new user in the database (password auto-hashed by model hook)
      const createUser = await User.create({
        roleType: 'user', // Default role is user
        roleId: defaultRole?.id || null, // Assign default role ID
        userType: body.userType || 'user', // Use the provided userType, default to 'user'
        userName: body?.userName,
        password: body?.password,
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
        status: 'active',
        modifiedAt: moment().format('YYYY-MM-DD HH:mm:ss')
      })
      createAudit(
        req,
        'create',
        'user',
        createUser.id,
        `Created user: ${createUser.userName || createUser.id}`
      )

      const result = createUser.toJSON()
      delete result.password // Remove the password before sending it back

      // Generate token
      result.token = generateToken({
        id: result?.id,
        userName: result?.userName,
        fullName: result?.fullName,
        roleType: result?.roleType || 'user'
      })

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
exports.editUser = async (req, res) => {
  try {
    const { body } = req
    const imageFile = req.file

    if (!body?.email) {
      return res.status(400).json({ message: 'Email wajib diisi' })
    }

    const existingUser = await User.findOne({
      where: { email: body.email }
    })

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Security: users may only edit their own profile
    if (existingUser.id !== req.user?.id) {
      return res.status(403).json({
        message: 'Anda hanya dapat mengubah profil Anda sendiri'
      })
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
    createAudit(
      req,
      'update',
      'user',
      updatedUser.id,
      `Updated user: ${updatedUser.id}`
    )

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

const RESET_TOKEN_TTL_MINUTES = 15

const getFrontendUrl = () =>
  process.env.FRONTEND_URL || 'http://localhost:5173'

// Request Password Reset (step 1): generate a one-time token and email it.
// Always returns the same response whether or not the email exists so the
// endpoint does not leak which accounts are registered.
exports.requestResetPassword = async (req, res) => {
  const body = req?.body
  const email = String(body?.email || '').trim().toLowerCase()

  if (!email) {
    return res.status(400).json({ error: 'Email wajib diisi' })
  }

  try {
    const existingUser = await User.findOne({ where: { email } })

    if (existingUser) {
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000)

      existingUser.resetToken = token
      existingUser.resetTokenExpires = expiresAt
      await existingUser.save()

      const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
      const mail = buildResetPasswordEmail({
        name: existingUser.fullName,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES
      })

      try {
        await sendEmail({ to: email, ...mail })
      } catch (emailError) {
        console.error('Reset password email failed to send:', emailError.message)
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEV] Reset password link for ${email}: ${resetUrl}`)
        }
      }

      createAudit(
        req,
        'request-reset',
        'user',
        existingUser.id,
        `Requested password reset for user ${existingUser.id}`
      )
    }

    return res.status(200).json({
      message:
        'Jika email terdaftar, tautan atur ulang kata sandi telah dikirim. Cek kotak masuk Anda.'
    })
  } catch (error) {
    console.error('ERROR requestResetPassword:', error)
    return res.status(500).json({ error: 'Terjadi Kesalahan Internal Server' })
  }
}

// Reset Password (step 2): requires the one-time token emailed in step 1.
exports.resetPassword = async (req, res) => {
  const body = req?.body

  if (!body?.email || !body?.token || !body?.newPassword || !body?.confirmPassword) {
    return res.status(400).json({
      error: 'Email, token, New Password, dan Confirm Password harus diisi'
    })
  }

  if (body.newPassword !== body.confirmPassword) {
    return res.status(400).json({
      error: 'New Password dan Confirm Password tidak cocok'
    })
  }

  if (body.newPassword.length < 6) {
    return res.status(400).json({
      error: 'Password minimal 6 karakter'
    })
  }

  try {
    const email = String(body.email).trim().toLowerCase()
    const existingUser = await User.findOne({ where: { email } })

    if (
      !existingUser ||
      !existingUser.resetToken ||
      existingUser.resetToken !== String(body.token) ||
      !existingUser.resetTokenExpires ||
      new Date(existingUser.resetTokenExpires).getTime() < Date.now()
    ) {
      return res.status(400).json({
        error: 'Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa. Silakan minta ulang.'
      })
    }

    existingUser.password = body.newPassword
    existingUser.resetToken = null
    existingUser.resetTokenExpires = null
    await existingUser.save()

    createAudit(
      req,
      'reset-password',
      'user',
      existingUser.id,
      `Password reset for user ${existingUser.id}`
    )

    return res.status(200).json({
      message: 'Password berhasil direset. Silakan login dengan password baru.'
    })
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
exports.logout = async (req, res) => {
  try {
    const user = req.user

    if (!user) {
      return res.status(401).json({
        message: 'Unauthorized'
      })
    }

    await User.update({ status: 'inactive' }, { where: { id: user.id } })

    res.clearCookie('token')

    return res.status(200).json({
      message: 'User Berhasil Logout'
    })
  } catch (error) {
    console.log('ERROR LOGOUT =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
