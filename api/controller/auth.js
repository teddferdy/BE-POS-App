/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const User = require('../../db/models/user')
const Location = require('../../db/models/location')
const Position = require('../../db/models/position')
const generateToken = require('../../utils/jwtConvert')
const bcrypt = require('bcrypt')
const moment = require('moment')
const { Op } = require('sequelize')

// Get User By Location
exports.userByLocation = async (req, res) => {
  const { location } = req.query
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
      storeName: locationData.nameStore,
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
  const { store, id, userType, position } = req.body

  try {
    // Update the userType and position of the user with the given store and id
    const [affectedRows, updatedUsers] = await User.update(
      { userType, position, store },
      {
        returning: true,
        where: { id }
      }
    )

    // Check if the update was successful
    if (affectedRows === 0) {
      return res.status(404).json({
        message: 'User not found or no changes made.'
      })
    }

    return res.status(200).json({
      message: 'User role updated successfully',
      data: updatedUsers[0]?.dataValues || null
    })
  } catch (error) {
    console.error('Error updating user role:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Get All List User
exports.getAllUser = async (req, res, next) => {
  try {
    const getAllUser = await User.findAll().then((res) =>
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
  } finally {
    console.log('resEND')
    return res.end()
  }
}

exports.login = async (req, res, next) => {
  const body = req.body
  const bodyUserNameOrEmail = body.userName // userName input from FE

  try {
    // Regex to check if the input is an email
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bodyUserNameOrEmail)

    // Find user by either email or username
    const findUser = isEmail
      ? await User.findOne({
          where: {
            email: bodyUserNameOrEmail
          }
        })
      : await User.findOne({
          where: {
            userName: bodyUserNameOrEmail
          }
        })

    console.log('findUser =>', findUser)

    // If no user is found or password does not match
    if (!findUser || !body.password === findUser.password) {
      return res.status(401).json({
        message: 'User Name / Email & Password Tidak Ditemukan'
      })
    }

    // Update the user's status to active
    await User.update(
      { statusActive: true },
      {
        where: isEmail
          ? { email: bodyUserNameOrEmail }
          : { userName: bodyUserNameOrEmail }
      }
    )

    // Generate a token for the user
    const getToken = generateToken({
      id: findUser.id
    })

    // Set token in a cookie
    if (
      findUser.dataValues.userType !== 'user' &&
      findUser.dataValues.userType !== 'admin'
    ) {
      return res.status(200).json({
        message: 'Success Login',
        token: getToken,
        user: findUser?.dataValues
      })
    } else {
      const locationByIdUserLogin = await Location.findOne({
        where: {
          id: findUser.dataValues.store
        }
      })

      const positionByIdUserLogin = await Position.findOne({
        where: {
          id: findUser.dataValues.position
        }
      })

      return res.status(200).json({
        message: 'Success Login',
        token: getToken,
        user: {
          ...findUser?.dataValues,
          storeName: locationByIdUserLogin?.dataValues?.nameStore ?? '',
          positionName: positionByIdUserLogin?.dataValues?.name ?? ''
        }
      })
    }
  } catch (error) {
    console.log('ERROR BRAY =>', error)

    return res.status(500).json({
      message: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
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
      // Generate Employee ID in the format BSN-XXXXX
      const randomFiveNumber = Math.floor(10000 + Math.random() * 90000) // Random 5-digit number
      const employeeID = `BSN-${randomFiveNumber}` // Create the Employee ID with 8 chars

      // Provide default values for fields that may be null
      const shift = body?.shift !== undefined ? body.shift : 0 // Set to 0 or a default valid value
      const position = body?.position !== undefined ? body.position : 0 // Set to 0 or a default valid value

      // Create new user in the database
      const createUser = await User.create({
        userType: body.userType || 'user', // Use the provided userType, default to 'user'
        userName: body?.userName,
        password: body?.password,
        email: body?.email,
        address: body.address,
        employeeID: employeeID, // Assign generated Employee ID
        phoneNumber: body?.phoneNumber || '',
        gender: body?.gender || '',
        store: body.store || null, // Store ID should not be null, ensure FE sends it
        placeDateOfBirth: body?.placeDateOfBirth || '',
        shift: shift, // Assign default value if undefined
        position: position, // Assign default value if undefined
        accessMenu: body?.accessMenu || null,
        statusEmployee: true,
        statusActive: true,
        modifiedAt: moment().format('YYYY-MM-DD HH:mm:ss')
      })

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
    const body = req.body
    const getUser = await User.update(
      {
        userName: body?.userName,
        address: body?.address,
        gender: body?.gender,
        phoneNumber: body?.phoneNumber,
        placeDateOfBirth: body?.placeDateOfBirth,
        deletedAt: null
      },
      {
        returning: true,
        where: {
          email: body.email,
          id: body.id
        }
      }
    ).then(([_, data]) => {
      return data
    })

    if (getUser?.dataValues) {
      return res.status(200).json({
        message: 'Sukses Ubah Profile User',
        data: []
      })
    } else {
      return res.status(401).json({
        message: 'User Tidak Ditemukan'
      })
    }
  } catch (error) {
    console.log('ERROR BRAY', error)

    return res.status(500).json({
      message: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Reset Password
exports.resetPassword = async (req, res, next) => {
  const body = req?.body
  try {
    await User.update(
      {
        password: bcrypt.hashSync(body?.password, 10)
      },
      {
        where: {
          userName: body?.userName
        }
      }
    )

    const findUser = await User.findOne({
      where: {
        userName: body?.userName
      }
    })

    if (findUser.dataValues) {
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
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
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
  } finally {
    console.log('resEND')
    return res.end()
  }
}
