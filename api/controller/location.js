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
const folderId = '15L9FRd7LVo8iXS7_h06AV-5UVLmK5pOd'

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

// Get All Locations for Dropdown
exports.getAllLocation = async (req, res) => {
  try {
    const locations = await Location.findAll({ where: { status: true } })
    return res.status(200).json({ message: 'Success', data: locations })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

// Get All Locations for Table
exports.getAllLocationInTable = async (req, res) => {
  try {
    const locations = await Location.findAll()
    return res.status(200).json({ message: 'Success', data: locations })
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

// Add New Location
exports.addNewLocation = async (req, res) => {
  const { nameStore, address, detailLocation, phoneNumber, status, createdBy } =
    req.body
  const imageFile = req.file

  try {
    const existingLocation = await Location.findOne({ where: { nameStore } })
    if (existingLocation)
      return res.status(403).json({ message: 'Location already exists' })

    const existingFile = await findFileByName(imageFile.originalname)
    if (existingFile) await drive.files.delete({ fileId: existingFile.id })

    const imageUrl = await uploadImageToDrive(
      imageFile.path,
      imageFile.originalname
    )

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
  }
}

exports.editLocationById = async (req, res) => {
  const { id, nameStore, status, confirmUserUpdate, ...rest } = req.body
  if (!id)
    return res
      .status(400)
      .json({ error: 'ID is required to update the location.' })

  try {
    const location = await Location.findByPk(id)
    if (!location) return res.status(404).json({ error: 'Location not found.' })

    const dataExist = location.dataValues

    let imageUrl = dataExist.image
    if (req.file) {
      const oldImageFileId = dataExist.image.split('id=')[1].split('&')[0]
      await drive.files.delete({ fileId: oldImageFileId })
      imageUrl = await uploadImageToDrive(req.file.path, req.file.originalname)
    }

    const updatedData = { ...rest, image: imageUrl, nameStore, status }

    if (compareObjects(dataExist, updatedData)) {
      return res.status(403).json({ message: 'The location already exists.' })
    }

    if (nameStore !== dataExist.nameStore && confirmUserUpdate) {
      await User.update({ store: id }, { where: { store: id } })
    }

    const [_, updatedLocation] = await Location.update(updatedData, {
      returning: true,
      where: { id }
    })

    await batchUpdateModels(id, { status, nameStore })

    return res.status(200).json({
      message: 'Successfully updated location.',
      data: updatedLocation.dataValues
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

// Delete Location By ID
exports.deleteLocationById = async (req, res) => {
  const { id } = req.body

  try {
    const location = await Location.findByPk(id)
    if (!location)
      return res.status(404).json({ message: 'Location not found' })

    await Location.destroy({ where: { id }, force: true })
    return res.status(200).json({ message: 'Location deleted successfully' })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  } finally {
    return res.end()
  }
}

// Batch update related models
const batchUpdateModels = async (id, updateFields) => {
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

  for (const model of modelsToUpdate) {
    await model.update(updateFields, { where: { store: id } })
  }
}
