/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const User = require('../../db/models/user')
const Location = require('../../db/models/location')
const Position = require('../../db/models/position')
const generateToken = require('../../utils/jwtConvert')
const bcrypt = require('bcrypt')
const moment = require('moment')
const { Op } = require('sequelize')

const { google } = require('googleapis')
const path = require('path')
const fs = require('fs')
const CLIENT_ID =
  '1039712103717-fl89g0bcmekc2lqeajtdnp1ka11u0s6u.apps.googleusercontent.com'
const CLIENT_SECRET = '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'
const REDIRECT_URI = 'https://developers.google.com/oauthplayground'
const REFRESH_TOKEN =
  '1//04J2pW5UoO4JOCgYIARAAGAQSNwF-L9IreIexo4pOeEPsEMjKXcyFDmPcoTL8pLWD8YCo0-wTfdSIGG2_MGSZDHLa8E3AIXDNpAg'

// Load Google API credentials
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
)

// Set the credentials
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN })

const folderId = '17ilBFQ8WOvIT40Fnkh5DegSqapImMZhh' // Replace with your Google Drive folder ID

// Function to search for a file in Google Drive by name
const findFileByName = async (fileName) => {
  try {
    const response = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents`,
      fields: 'files(id, name)',
      spaces: 'drive'
    })
    return response.data.files[0] // Return the first matching file if found
  } catch (error) {
    throw new Error('Error searching for file on Google Drive')
  }
}

// Function to delete a file by its Google Drive file ID
const deleteFile = async (fileId) => {
  try {
    await drive.files.delete({ fileId })
  } catch (error) {
    throw new Error('Error deleting file from Google Drive')
  }
}

// Function to upload an image to Google Drive
const uploadImageToDrive = async (filePath, fileName) => {
  const accessTokenInfo = await oauth2Client.getAccessToken()

  if (!accessTokenInfo.token) {
    throw new Error('Failed to obtain access token')
  }

  if (!fs.existsSync(filePath)) {
    throw new Error('File not found')
  }

  const fileMetadata = {
    name: fileName,
    parents: [folderId]
  }

  const media = {
    mimeType: 'image/jpeg',
    body: fs.createReadStream(filePath)
  }

  try {
    const { data: file } = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    })

    await drive.permissions.create({
      fileId: file.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    })

    return `https://drive.google.com/uc?id=${file.id}`
  } catch (error) {
    throw new Error('Failed to upload image')
  }
}

// Use the access token for the Drive API
const drive = google.drive({ version: 'v3', auth: oauth2Client })

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
    const { body } = req
    const imageFile = req.file
    const existingUser = await User.findOne({
      where: { email: body.email, id: body.id }
    })

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    let imageUrl = existingUser.imageUrl // Keep current image URL by default
    let oldFileId

    if (req.file) {
      const oldImageName = path.basename(existingUser.imageUrl)
      const uploadedImage = await uploadImageToDrive(
        imageFile.path,
        imageFile.originalname
      )

      if (oldImageName !== req.file.originalname) {
        const oldImage = await findFileByName(oldImageName)
        if (oldImage) oldFileId = oldImage.id
        imageUrl = uploadedImage
      }
    }

    const updatedUser = await existingUser.update({
      userName: body.userName,
      address: body.address,
      gender: body.gender,
      phoneNumber: body.phoneNumber,
      placeDateOfBirth: body.placeDateOfBirth,
      imageUrl: imageUrl,
      deletedAt: null
    })

    if (oldFileId) await deleteFile(oldFileId) // Delete old image if a new one was uploaded

    return res.status(200).json({
      message: 'Successfully updated user profile',
      data: updatedUser
    })
  } catch (error) {
    console.error('ERROR:', error)
    return res.status(500).json({ message: 'Internal server error' })
  } finally {
    res.end()
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
