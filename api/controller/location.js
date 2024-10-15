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
const GOOGLE_API_CREDENTIALS = require('../../google_apis.json')

// Load Google API credentials
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
)

// Set the credentials
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN })

const uploadImageToDrive = async (filePath, fileName) => {
  // Automatically refresh access token before API call
  const accessTokenInfo = await oauth2Client.getAccessToken()

  if (!accessTokenInfo.token) {
    throw new Error('Failed to obtain access token')
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  const folderId = '1yxoVp4CzYMtSpR6UX1pY1Dv2bajYMoCM'

  if (!fs.existsSync(filePath)) {
    console.error('File does not exist at the specified path:', filePath)
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
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    })

    console.log('FILE =>', file)

    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    })

    const publicUrl = `https://drive.google.com/uc?id=${file.data.id}`
    return publicUrl
  } catch (error) {
    console.error(
      'Error uploading image to Google Drive:',
      error.message,
      error.stack
    )
    throw new Error('Failed to upload image')
  }
}

// Example usage of the function
;(async () => {
  try {
    const publicUrl = await uploadImageToDrive(
      '/path/to/your/image.jpg',
      'image.jpg'
    )
    console.log('Uploaded image URL:', publicUrl)
  } catch (error) {
    console.error('Error:', error.message)
  }
})()

// Use the access token for the Drive API
const drive = google.drive({ version: 'v3', auth: oauth2Client })

// Get All List To Dropdown
exports.getAllLocation = async (req, res, next) => {
  try {
    const getAllLocation = await Location.findAll({
      where: {
        status: true
      }
    }).then((res) =>
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
exports.addNewLocation = async (req, res, next) => {
  const body = req.body
  const imageFile = req.file // Get the image file from multer

  try {
    const findOneLocation = await Location.findOne({
      where: { nameStore: body.nameStore }
    })

    if (!findOneLocation) {
      // Upload image to Google Drive and get the URL
      const imageUrl = await uploadImageToDrive(
        imageFile.path,
        imageFile.originalname
      )

      // Create new location with uploaded image URL
      const createdLocation = await Location.create({
        image: imageUrl,
        nameStore: body.nameStore,
        address: body.address,
        detailLocation: body.detailLocation,
        phoneNumber: body.phoneNumber,
        status: body.status,
        createdBy: body.createdBy
      })

      if (createdLocation) {
        return res.status(200).json({
          message: 'Location created successfully'
        })
      }
    } else {
      return res.status(403).json({
        message: 'Location already exists'
      })
    }
  } catch (error) {
    console.error('Internal server error:', error)
    return res.status(500).json({
      error: 'Internal server error'
    })
  } finally {
    console.log('Response end')
    res.end()
  }
}

exports.editLocationById = async (req, res, next) => {
  const body = req.body
  const { confirmUserUpdate } = body

  try {
    // Check for an existing store with the same name
    const getDuplicate = await Location.findOne({
      where: { id: body?.id }
    })

    const bodyReq = {
      id: body?.id,
      image: body.image,
      nameStore: body?.nameStore,
      address: body?.address,
      detailLocation: body?.detailLocation,
      phoneNumber: body?.phoneNumber,
      status: body?.status
    }

    const dataExist = getDuplicate
      ? {
          id: getDuplicate.dataValues.id,
          image: getDuplicate.dataValues.image,
          nameStore: getDuplicate.dataValues.nameStore,
          address: getDuplicate.dataValues.address,
          detailLocation: getDuplicate.dataValues.detailLocation,
          phoneNumber: getDuplicate.dataValues.phoneNumber,
          status: getDuplicate.dataValues.status
        }
      : null

    const resultValue = compareObjects(dataExist, bodyReq)
    console.log('resultValue =>', resultValue)

    if (resultValue) {
      return res.status(403).json({
        message: 'The location already exists.'
      })
    } else {
      // Check if users are associated with the old store name
      const checkUser = await User.findAll({
        where: { location: dataExist?.nameStore }
      })

      if (checkUser.length > 0 && !confirmUserUpdate) {
        return res.status(200).json({
          message:
            'Users are already associated with this store. Do you want to update their store assignment?',
          showUserUpdateDialog: true
        })
      }

      if (confirmUserUpdate) {
        await User.update(
          { location: body.nameStore },
          { where: { location: dataExist?.nameStore } }
        )
      }

      // Check if the image has changed
      if (body.image !== dataExist?.image) {
        // Extract file ID from the existing image URL
        const oldImageFileId = dataExist.image.split('id=')[1].split('&')[0]

        // Delete the old image from Google Drive
        await drive.files.delete({ fileId: oldImageFileId })
        console.log(`Deleted old image with ID: ${oldImageFileId}`)

        // Upload the new image and get the URL
        const imageUrl = await uploadImageToDrive(
          req.file.path, // Use the new image path
          req.file.originalname
        )
        body.image = imageUrl // Update the body to use the new image URL
      }

      // Update the location in the Location table
      const editLocation = await Location.update(
        {
          image: body.image,
          nameStore: body.nameStore,
          address: body.address,
          detailLocation: body.detailLocation,
          phoneNumber: body.phoneNumber,
          status: body.status,
          createdBy: body.createdBy,
          modifiedBy: body.modifiedBy
        },
        { returning: true, where: { id: body.id } }
      ).then(([_, data]) => data)

      // Handle status updates
      if (body.status === false) {
        const modelsToUpdate = [
          {
            model: User,
            field: 'location',
            value: body.nameStore,
            updateFields: { statusActive: false }
          },
          {
            model: Product,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: Transaction,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: BestSelling,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: Checkout,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: Category,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: SubCategoryProduct,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: Discount,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: InvoiceFooter,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: InvoiceLogo,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: InvoiceSocialMedia,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: Member,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: SocialMedia,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: TypePayment,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          },
          {
            model: Shift,
            field: 'store',
            value: body.nameStore,
            updateFields: { status: false }
          }
        ]

        for (const { model, field, value, updateFields } of modelsToUpdate) {
          const record = await model.findOne({ where: { [field]: value } })
          if (record) {
            await model.update(updateFields, { where: { [field]: value } })
          }
        }
      }

      if (body.status === true && body.nameStore !== dataExist?.nameStore) {
        const modelsToUpdate = [
          {
            model: User,
            field: 'location',
            value: dataExist?.nameStore,
            updateFields: { location: body?.nameStore }
          },
          {
            model: Product,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: Transaction,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: BestSelling,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: Checkout,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: Category,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: SubCategoryProduct,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: Discount,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: InvoiceFooter,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: InvoiceLogo,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: InvoiceSocialMedia,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: Member,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: SocialMedia,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: TypePayment,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          },
          {
            model: Shift,
            field: 'store',
            value: dataExist?.nameStore,
            updateFields: { store: body?.nameStore }
          }
        ]

        for (const { model, field, value, updateFields } of modelsToUpdate) {
          const record = await model.findOne({ where: { [field]: value } })
          if (record) {
            await model.update(updateFields, { where: { [field]: value } })
          }
        }
      }

      return res.status(200).json({
        message: 'Successfully updated location.',
        data: editLocation?.dataValues
      })
    }
  } catch (error) {
    console.log('ERROR =>', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Delete Location By Id
exports.deleteLocationById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await Location.destroy({
      where: {
        id: body.id,
        nameStore: body.nameStore
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Lokasi'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Lokasi Gagal'
      })
    }
  } catch (error) {
    console.log('ERROR =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}
