/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
// Connect DB
const Product = require('../../db/models/product')
const Category = require('../../db/models/category')
const SubCategoryProduct = require('../../db/models/sub_category')
const { compareProduct } = require('../../utils/compare-value')
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

const folderId = '14amtGW104xLNqImWsJX1EC3c0atYAu_M' // Replace with your Google Drive folder ID

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

// Get Product By Location Store
exports.getProductByLocationSuperAdmin = async (req, res, next) => {
  const { store } = req.query
  try {
    const getAllProduct = await Product.findAll({
      where: {
        store: store,
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
      data: getAllProduct?.length > 0 ? getAllProduct : []
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

// Get All In Cashier List
exports.getAllProduct = async (req, res, next) => {
  const { nameProduct, category, store } = req.query

  try {
    const filters = {}

    if (nameProduct) {
      filters.nameProduct = {
        [Op.like]: `${nameProduct}%`
      }
    }

    if (Number(category)) {
      filters.category = Number(category)
    }
    if (store) {
      filters.store = store
    }

    filters.status = true

    const getAllProduct = await Product.findAll({
      where: filters
    })

    // Fetch categories and resolve subcategories
    const resolvedSubCategories = await Promise.all(
      getAllProduct.map(async (items) => {
        const categoryData = await Category.findOne({
          where: {
            id: items.dataValues.category
          },
          returning: true
        })

        return {
          ...items.dataValues,
          nameCategory: categoryData ? categoryData.value : null
        }
      })
    )

    // Resolve subcategory options for each product
    const dataNewFormat = await Promise.all(
      resolvedSubCategories.map(async (items) => {
        const resolvedOptions = await Promise.all(
          items.option.map(async (val) => {
            const categoryData = await SubCategoryProduct.findOne({
              where: {
                id: val
              },
              returning: true
            })

            return categoryData
              ? {
                  isMultiple: categoryData.isMultiple,
                  nameSubCategory: categoryData.nameSubCategory,
                  typeSubCategory: categoryData.typeSubCategory
                }
              : null
          })
        )

        return {
          ...items,
          option: resolvedOptions
        }
      })
    )

    const responseData = dataNewFormat.map((items) => {
      return {
        ...items
      }
    })

    return res.status(200).json({
      message: 'Success',
      data: responseData.length > 0 ? responseData : []
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

// Get All In Table
exports.getAllProductInTable = async (req, res, next) => {
  const { store } = req.query
  try {
    const getAllProduct = await Product.findAll({
      where: {
        store: store
      }
    })

    // Fetch categories and resolve subcategories
    const resolvedSubCategories = await Promise.all(
      getAllProduct.map(async (items) => {
        const categoryData = await Category.findOne({
          where: {
            id: items.dataValues.category
          },
          returning: true
        })

        return {
          ...items.dataValues,
          nameCategory: categoryData ? categoryData.name : null
        }
      })
    )

    // Resolve subcategory options for each product
    const dataNewFormat = await Promise.all(
      resolvedSubCategories.map(async (items) => {
        const resolvedOptions = await Promise.all(
          items.option.map(async (val) => {
            const categoryData = await SubCategoryProduct.findOne({
              where: {
                id: val
              },
              returning: true
            })

            return categoryData
              ? {
                  id: categoryData.id,
                  name: categoryData.nameSubCategory,
                  option: JSON.parse(categoryData.typeSubCategory),
                  isMultiple: categoryData.isMultiple
                }
              : null
          })
        )

        return {
          ...items,
          option: resolvedOptions
        }
      })
    )

    const responseData = dataNewFormat.map((items) => {
      return {
        ...items
      }
    })

    return res.status(200).json({
      message: 'Success',
      data: responseData.length > 0 ? responseData : []
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

// Function Post Add Form Product
exports.postAddProduct = async (req, res, next) => {
  console.log('req.body =>', req.body)
  const {
    nameProduct,
    category,
    status,
    description,
    price,
    createdBy,
    image,
    option,
    isOption,
    store
  } = req.body

  try {
    // Check if a product with the same name exists in the store
    const existingProduct = await Product.findOne({
      where: {
        store,
        nameProduct
      }
    })

    if (existingProduct) {
      return res.status(400).json({
        message: 'Product with this name already exists in the store.'
      })
    }

    const imageFile = req.file
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

    const optionsArray = isOption && Array.isArray(option) ? option : []

    // Create new product
    const postData = await Product.create({
      nameProduct,
      category,
      description,
      price,
      status,
      isOption,
      option: optionsArray, // Ensure it's an array
      createdBy,
      image: imageUrl || image, // Use the uploaded image URL or fallback to provided image
      store
    })

    return res.status(200).json({
      status: 'success',
      data: postData
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Render Edit Form Product
exports.editProductByLocationAndId = async (req, res, next) => {
  const {
    id,
    nameProduct,
    category,
    status,
    description,
    price,
    image: newImage,
    option,
    isOption,
    store
  } = req.body

  try {
    const getAllProductByIdAndLocation = await Product.findOne({
      where: {
        id: id,
        store: store
      }
    })

    if (!getAllProductByIdAndLocation) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    const oldImage = getAllProductByIdAndLocation.image
    let imageUrl = oldImage

    if (req.file) {
      if (newImage && oldImage !== newImage) {
        const oldImageFileId = oldImage.split('id=')[1].split('&')[0]
        await drive.files.delete({ fileId: oldImageFileId })

        imageUrl = await uploadImageToDrive(
          req.file.path,
          req.file.originalname
        )
      }
    }

    const reqBody = {
      nameProduct,
      image: imageUrl,
      category,
      description,
      price,
      isOption,
      option: option.split(','),
      status,
      store
    }

    const duplicateData = {
      nameProduct: getAllProductByIdAndLocation.nameProduct,
      image: imageUrl,
      category: getAllProductByIdAndLocation.category,
      description: getAllProductByIdAndLocation.description,
      price: getAllProductByIdAndLocation.price,
      isOption: getAllProductByIdAndLocation.isOption,
      option: getAllProductByIdAndLocation.option,
      status: getAllProductByIdAndLocation.status,
      store: getAllProductByIdAndLocation.store
    }

    const result = compareProduct(reqBody, duplicateData)

    if (!result) {
      const [_, editLocation] = await Product.update(reqBody, {
        returning: true,
        where: {
          id: id
        }
      })

      return res.status(200).json({
        message: 'Sukses Ubah Product',
        data: editLocation?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Product Sudah Terdaftar'
      })
    }
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

exports.deleteProductByIdAndLocation = async (req, res, next) => {
  const { id, nameProduct, store } = req.body
  try {
    const getId = await Product.destroy({
      where: {
        id: id,
        nameProduct: nameProduct,
        store: store
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Product'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Product Gagal'
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
