/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const InvoiceLogo = require('../../db/models/invoice_logo')
const { Op } = require('sequelize')

const { google } = require('googleapis')
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

const folderId = '1xKR8S6Meon-qARqsLUmp4rOC9ELiTyRr' // Replace with your Google Drive folder ID

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

// Get Logo Using By Location
exports.getInvoiceLogoByLocation = async (req, res, next) => {
  const { store } = req.query

  try {
    const invoiceLogo = await InvoiceLogo.findAll({
      where: {
        store: store,
        isActive: true
      }
    })
    return res.status(200).json({
      message: 'Success',
      data:
        invoiceLogo?.length > 0
          ? invoiceLogo?.map((items) => {
              return {
                ...items?.dataValues
              }
            })
          : []
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

// Get Logo Using To Invoice
exports.getInvoiceLogoByIsActive = async (req, res, next) => {
  const { store } = req.query
  try {
    const invoiceLogo = await InvoiceLogo.findAll({
      where: {
        isActive: true,
        store: store
      }
    })
    return res.status(200).json({
      message: 'Success',
      data:
        invoiceLogo?.length > 0
          ? invoiceLogo?.map((items) => {
              return {
                ...items?.dataValues
              }
            })
          : []
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

// Get All Invoice Logo
exports.getAllInvoiceLogo = async (req, res, next) => {
  const { store } = req.query
  try {
    const invoiceLogo = await InvoiceLogo.findAll({
      where: {
        store: store
      }
    })
    return res.status(200).json({
      message: 'Success',
      data:
        invoiceLogo?.length > 0
          ? invoiceLogo?.map((items) => {
              return {
                ...items?.dataValues
              }
            })
          : []
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

// Post New Invoice Logo
exports.postNewInvoiceLogo = async (req, res, next) => {
  const { image, isActive, status, createdBy, store } = req.body
  const imageFile = req.file

  console.log('imageFile =>', imageFile)

  try {
    // Check if the image already exists in Google Drive by file name
    const existingFile = await findFileByName(imageFile.originalname)

    // If file exists in Google Drive
    if (existingFile) {
      return res.status(403).json({
        message: 'Invoice Logo already exists in Google Drive'
      })
    }

    let imageUrl = null

    if (imageFile) {
      // Check if a file with the same name exists on Google Drive
      const existingFile = await findFileByName(imageFile.originalname)

      // If file exists, delete the old image from Google Drive
      if (existingFile) {
        await deleteFile(existingFile.id)
      }

      // Upload the new image to Google Drive and get the URL
      imageUrl = await uploadImageToDrive(
        imageFile.path,
        imageFile.originalname
      )
    }

    // Save the new logo data in the database
    const postData = await InvoiceLogo.create({
      image: imageUrl || image, // Use the uploaded image URL or fallback to provided image
      isActive: isActive,
      store: store,
      status: status,
      createdBy: createdBy
    })

    // Return success response
    return res.status(200).json({
      status: 'success',
      data: postData
    })
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Edit InvoiceLogo By Id
exports.editInvoiceLogoById = async (req, res, next) => {
  console.log('req.body =.', req.body)

  const { id, image, isActive, status, createdBy, store } = req.body // Destructure directly from req.body
  const imageFile = req.file // Assuming multer is used for file uploads
  let newImageUrl
  console.log('req.file =.', req.file)

  try {
    // Check for duplicates in the database
    const getDuplicate = await InvoiceLogo.findOne({
      where: {
        image: imageFile.originalname, // Check for the same image name
        store: store // Check for the same store
      }
    })

    // Handle uploading a new image if provided
    if (imageFile) {
      // If a new image file is uploaded
      newImageUrl = await uploadImageToDrive(
        imageFile.path,
        imageFile.originalname
      ) // Upload the new image
    } else if (getDuplicate) {
      // If no new image is uploaded, use existing URL
      newImageUrl = getDuplicate.image
    }

    // Update the invoice logo details in the database
    const [_, updatedInvoiceLogo] = await InvoiceLogo.update(
      {
        image: newImageUrl || image, // Use the new image URL or the existing image name
        status: status,
        createdBy: createdBy,
        modifiedBy: req.user?.id || null, // Assuming you have the user ID in req.user
        isActive: isActive // Update the active status
      },
      {
        returning: true,
        where: {
          id: id,
          store: store
        }
      }
    )

    // If updated successfully, return the new data
    return res.status(200).json({
      message: 'Sukses Ubah Invoice Logo',
      data: updatedInvoiceLogo[0] // Return the updated data
    })
  } catch (error) {
    console.error('Error =>', error) // Log error for debugging
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Delete Invoice Logo By Id
exports.deleteInvoiceLogoById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await InvoiceLogo.destroy({
      where: {
        id: body.id,
        image: body.image,
        store: body.store
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Invoice Logo'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Invoice Logo Gagal'
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

// Activae / Not Activate Invoice By ID
exports.activateInvoiceLogoById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await InvoiceLogo.findOne({
      where: {
        image: body.image,
        store: body.store
      }
    })

    const getAllLogoNotById = await InvoiceLogo.findAll({
      where: {
        image: { [Op.notLike]: body.image },
        store: body.store
      }
    }).then((items) => {
      return items.map((val) => val.id)
    })

    getAllLogoNotById.forEach(async (items) => {
      await InvoiceLogo.update(
        {
          isActive: false
        },
        {
          where: {
            id: items,
            store: body.store
          }
        }
      )
    })

    if (getDuplicate?.dataValues) {
      const editInvoiceLogo = await InvoiceLogo?.update(
        {
          image: body.image,
          isActive: body.isActive
        },
        {
          returning: true,
          where: {
            id: body.id,
            store: body.store
          }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        message: 'Sukses Ubah Invoice Logo',
        data: editInvoiceLogo?.dataValues
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
