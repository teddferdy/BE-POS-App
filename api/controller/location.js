/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const { google } = require('googleapis')
const fs = require('fs')
const Location = require('../../db/models/location')
// Need Update
const User = require('../../db/models/user')
const BestSelling = require('../../db/models/best_selling')
const Checkout = require('../../db/models/checkout')
const Product = require('../../db/models/product')
const Category = require('../../db/models/category')
const SubCategoryProduct = require('../../db/models/sub_category')
const Discount = require('../../db/models/discount')
const InvoiceFooter = require('../../db/models/invoice_footer')
const InvoiceLogo = require('../../db/models/invoice_logo')
const InvoiceSocialMedia = require('../../db/models/invoice_social_media')
const Member = require('../../db/models/member')
const SocialMedia = require('../../db/models/social_media')
const TypePayment = require('../../db/models/type_payment')
const Transaction = require('../../db/models/transaction')
const Shift = require('../../db/models/shift')

const { compareObjects } = require('../../utils/compare-value')

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

const uploadImageToDrive = async (filePath, fileName) => {
  const accessTokenInfo = await oauth2Client.getAccessToken()

  if (!accessTokenInfo.token) {
    throw new Error('Failed to obtain access token')
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  const folderId = '15L9FRd7LVo8iXS7_h06AV-5UVLmK5pOd'

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

// Get All List To Dropdown
exports.getAllLocation = async (req, res) => {
  try {
    const locations = await Location.findAll({
      where: { status: true }
    })

    return res.status(200).json({
      message: 'Success',
      data: locations
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  } finally {
    return res.end()
  }
}

// Get All Location To Table
exports.getAllLocationInTable = async (req, res, next) => {
  try {
    const getAllLocation = await Location.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      message: 'Success',
      data: getAllLocation?.length > 0 ? getAllLocation : []
    })
  } catch (error) {
    console.log('Error =>', error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Add New Location
exports.addNewLocation = async (req, res) => {
  const { nameStore, address, detailLocation, phoneNumber, status, createdBy } =
    req.body
  const imageFile = req.file

  try {
    const existingLocation = await Location.findOne({ where: { nameStore } })

    if (existingLocation) {
      return res.status(403).json({ message: 'Location already exists' })
    }

    // Upload image to Google Drive and get URL
    const imageUrl = await uploadImageToDrive(
      imageFile.path,
      imageFile.originalname
    )

    // Create new location
    await Location.create({
      image: imageUrl,
      nameStore,
      imageName: imageFile.originalname,
      address,
      detailLocation,
      phoneNumber,
      status,
      createdBy
    })

    return res.status(200).json({ message: 'Location created successfully' })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  } finally {
    return res.end()
  }
}

exports.editLocationById = async (req, res) => {
  const body = req.body
  const { id, confirmUserUpdate, nameStore, image, status } = body

  if (!id) {
    return res
      .status(400)
      .json({ error: 'ID is required to update the location.' })
  }

  try {
    // Check for existing store
    const getDuplicate = await Location.findOne({ where: { id } })
    if (!getDuplicate) {
      return res.status(404).json({ error: 'Location not found.' })
    }

    const bodyReq = {
      id,
      image,
      nameStore,
      address: body.address,
      detailLocation: body.detailLocation,
      phoneNumber: body.phoneNumber,
      status
    }

    const dataExist = getDuplicate.dataValues
    const resultValue = compareObjects(dataExist, bodyReq)

    if (resultValue) {
      return res.status(403).json({ message: 'The location already exists.' })
    }

    // Handle user store update confirmation
    if (nameStore !== dataExist.nameStore) {
      const usersInStore = await User.findAll({ where: { store: id } })

      if (usersInStore.length > 0 && !confirmUserUpdate) {
        return res.status(200).json({
          message:
            'Users are associated with this store. Do you want to update their store assignment?',
          showUserUpdateDialog: true
        })
      }

      if (confirmUserUpdate) {
        await User.update({ store: id }, { where: { store: id } })
      }
    }

    // Handle image update
    if (image !== dataExist.image) {
      const oldImageFileId = dataExist.image.split('id=')[1].split('&')[0]
      await drive.files.delete({ fileId: oldImageFileId })
      const newImageUrl = await uploadImageToDrive(
        req.file.path,
        req.file.originalname
      )
      body.image = newImageUrl
    }

    // Update the location
    const [_, updatedLocation] = await Location.update(
      { ...bodyReq, createdBy: body.createdBy, modifiedBy: body.modifiedBy },
      { returning: true, where: { id } }
    )

    // Models to be updated based on store status
    const modelsToUpdate = [
      User,
      Product,
      Transaction,
      BestSelling,
      Checkout,
      Category,
      SubCategoryProduct,
      Discount,
      InvoiceFooter,
      InvoiceLogo,
      InvoiceSocialMedia,
      Member,
      SocialMedia,
      TypePayment,
      Shift
    ]

    // Update all relevant models' statuses based on location status
    const updateFields = (isActive) => ({
      status: isActive,
      ...(nameStore && { nameStore })
    })

    const updateRelatedModels = async (isActive) => {
      for (const model of modelsToUpdate) {
        const record = await model.findOne({ where: { store: id } })
        if (record) {
          await model.update(updateFields(isActive), { where: { store: id } })
        }
      }
    }

    // Handle status changes
    if (status === false) {
      await updateRelatedModels(false)
    } else if (status === true && nameStore !== dataExist.nameStore) {
      await updateRelatedModels(true)
    }

    return res.status(200).json({
      message: 'Successfully updated location.',
      data: updatedLocation?.dataValues
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  } finally {
    return res.end()
  }
}

// Delete Location By Id
exports.deleteLocationById = async (req, res) => {
  const { id } = req.body

  try {
    const location = await Location.findByPk(id)
    if (!location)
      return res.status(404).json({ message: 'Location not found' })

    // Delete the location
    await Location.destroy({ where: { id }, force: true })

    return res.status(200).json({ message: 'Location deleted successfully' })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  } finally {
    return res.end()
  }
}
