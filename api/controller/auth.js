/* eslint-disable no-unused-vars */
const User = require('../../db/models/user')
const generateToken = require('../../utils/jwtConvert')
const bcrypt = require('bcrypt')

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
      data: getAllUser.length > 0 ? getAllUser : 'Data Masih Kosong'
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.login = async (req, res, next) => {
  const body = req.body
  const bodyUserNameOrEmail = body.email || body.userName
  if (!bodyUserNameOrEmail || !body.password) {
    return res.status(401).json({
      message: 'User Name / Email & Password Tidak Boleh Kosong'
    })
  }

  try {
    const findUser = body?.email
      ? await User.findOne({
          where: {
            email: body.email
          }
        })
      : await User.findOne({
          where: {
            userName: body.userName
          }
        })

    if (
      !findUser ||
      !(await bcrypt.compare(body.password, findUser.password))
    ) {
      return res.status(401).json({
        message: 'User Name / Email & Password Tidak Ditemukan'
      })
    } else {
      const updateUser = body?.email
        ? await User.update(
            { statusActive: true },
            {
              where: {
                email: body.email
              }
            }
          )
        : await User.update(
            { statusActive: true },
            {
              where: {
                userName: body.userName
              }
            }
          )

      const getToken = generateToken({
        id: updateUser.id
      })

      return res.cookie('token', getToken).status(200).json({
        message: 'Success Login',
        token: getToken,
        user: findUser?.dataValues
      })
    }
  } catch (error) {
    console.log('ERROR BRAY =>', error)

    return res.status(500).json({
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Register
exports.registerNewUser = async (req, res, next) => {
  const body = req?.body

  try {
    if (!['admin', 'user']?.includes(body?.userType)) {
      res.status(400).json({
        message: 'Gagal Menyimpan User'
      })
    }

    // FInd One User Has Been Create
    const findUser = await User?.findOne({
      where: {
        userName: body?.userName,
        email: body?.email
      }
    })

    if (!findUser?.dataValues) {
      const createUser = await User?.create({
        userName: body?.userName,
        password: body?.password,
        confirmPassword: body?.confirmPassword,
        email: body?.email,
        location: body.location,
        userType: 'user',
        employeeID: '',
        address: '',
        phoneNumber: '',
        placeDateOfBirth: '',
        statusEmployee: true,
        statusActive: true,
        modifiedAt: ''
      })

      const result = createUser.toJSON()
      delete result?.password

      result.token = generateToken({
        id: result?.id
      })

      if (!result) {
        return res.status(400).json({
          message: 'Gagal Menyimpan User'
        })
      }

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
    console.log('INI ERROR REGISTER =>', error)

    return res.status(500).json({
      message: 'Terjadi Kesalahan Internal Server'
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
        location: body?.location,
        modifiedAt: body?.modifiedAt,
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
  }
}

// User Logout
exports.logout = (req, res, next) => {
  try {
    if (req.cookies.token) {
      res.clearCookie('token')
      return res.status(200).json({
        message: 'User Berhasil Logout'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
