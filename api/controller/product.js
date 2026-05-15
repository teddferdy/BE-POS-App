/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
// Connect DB
const Product = require('../../db/models/product')
const Category = require('../../db/models/category')
const SubCategoryProduct = require('../../db/models/sub_category')
const { compareProduct } = require('../../utils/compare-value')
const path = require('path')
const fs = require('fs')
const excelJS = require('exceljs')
const { Op } = require('sequelize')
const {
  uploadToCloudinary,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const {
  downloadProductTemplate,
  parseProductTemplate
} = require('../../utils/excelTemplate')

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

    console.log('responseData =>', responseData)

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
  const { store, page = 1, pageSize = 10, status = 'all' } = req.query // Default page = 1, pageSize = 10, status = 'all'

  try {
    const offset = (page - 1) * pageSize // Calculate the offset for pagination

    // Build the where condition based on the status filter
    let statusCondition = {}
    if (status === 'true') {
      statusCondition = { status: true }
    } else if (status === 'false') {
      statusCondition = { status: false }
    }

    // Combine store and status filter
    const whereCondition = {
      store: store,
      ...statusCondition // Add the status condition if applicable
    }

    // Fetch products with pagination and status filter
    const getAllProduct = await Product.findAll({
      where: whereCondition,
      limit: parseInt(pageSize), // Limit number of products per page
      offset: parseInt(offset) // Offset based on the current page
    })

    console.log('getAllProduct =>', getAllProduct)

    // Fetch categories and resolve subcategories
    const resolvedSubCategories = await Promise.all(
      getAllProduct.map(async (items) => {
        const categoryData = await Category.findOne({
          where: {
            id: items.dataValues.category
          }
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
              }
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

    console.log('responseData =>', responseData)

    // Get the total count of products for pagination, considering the status filter
    const totalProducts = await Product.count({
      where: whereCondition
    })

    return res.status(200).json({
      message: 'Success',
      data: responseData.length > 0 ? responseData : [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalProducts, // Total number of products
        totalPages: Math.ceil(totalProducts / pageSize) // Total pages
      }
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
      imageUrl = await uploadToCloudinary(imageFile.path, 'pos-app-products')
    }

    const optionsArray =
      isOption === 'true' && typeof option === 'string'
        ? option.split(',').map((opt) => {
            const numOpt = Number(opt)
            console.log(`Converted ${opt} to ${numOpt}`)
            return numOpt
          })
        : []

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

  console.log('req.body =>', req.body)

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
      if (oldImage) {
        await deleteFromCloudinary(oldImage)
      }

      imageUrl = await uploadToCloudinary(req.file.path, 'pos-app-products')
    }

    const optionsArray =
      isOption === 'true' && typeof option === 'string'
        ? option.split(',').map((opt) => {
            const numOpt = Number(opt)
            console.log(`Converted ${opt} to ${numOpt}`)
            return numOpt
          })
        : []

    const reqBody = {
      nameProduct,
      image: imageUrl,
      category,
      description,
      price,
      isOption,
      option: optionsArray, // Ensure it's an array
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

// Download Excel Template By Excel with dropdown list of categories by storeId
exports.exportProduct = async (req, res) => {
  const { storeId } = req.params // Get storeId from the request parameters

  // Create new workbook and worksheet
  const workbook = new excelJS.Workbook()
  const worksheet = workbook.addWorksheet('Product')

  // Ensure the download path exists
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true })
  }

  // Define columns for the worksheet
  worksheet.columns = [
    { header: 'No.', key: 's_no', width: 10 },
    { header: 'Name Product', key: 'nameProduct', width: 20 },
    { header: 'Image', key: 'image', width: 20 },
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Description', key: 'description', width: 20 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Price', key: 'price', width: 20 }
  ]

  // Make the header row bold
  worksheet.getRow(1).font = { bold: true }

  try {
    // Fetch categories filtered by storeId
    const categories = await Category.findAll({
      where: { storeId },
      attributes: ['name'] // Only select the 'name' field
    })

    if (!categories.length) {
      return res
        .status(404)
        .json({ message: 'No categories found for this store' })
    }

    // Prepare the category names for the dropdown list
    const categoryList = categories.map((cat) => cat.name).join(',')

    // Set data validation (dropdown list) for the 'Category' column (B2 onward)
    worksheet.getCell('F2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formula1: `"${categoryList}"`, // Excel requires the list to be in double quotes
      showDropDown: true
    }

    // Generate the Excel file in memory (buffer)
    const buffer = await workbook.xlsx.writeBuffer()

    // Set headers and send the Excel file as a response
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=product_template.xlsx'
    )

    res.send(buffer)
  } catch (err) {
    console.error('Error exporting product Excel file: ', err)
    res.status(500).send({
      status: 'error',
      message: 'Something went wrong while generating the Excel file',
      error: err.message
    })
  }
}

// Download Product Template
exports.downloadTemplate = async (req, res) => {
  const { storeId } = req.params

  try {
    const categories = await Category.findAll({
      where: { storeId },
      attributes: ['name']
    })

    if (!categories.length) {
      return res.status(404).json({
        message:
          'Tidak ada kategori untuk store ini. Silakan buat kategori terlebih dahulu.'
      })
    }

    const existingProducts = await Product.findAll({
      where: { store: storeId },
      include: [
        {
          model: Category,
          as: 'categoryData',
          attributes: ['name']
        }
      ]
    })

    const productsWithCategory = existingProducts.map((p) => ({
      id: p.id,
      nameProduct: p.nameProduct,
      image: p.image || '',
      description: p.description,
      categoryName: p.categoryData?.name || '',
      price: p.price,
      status: p.status,
      isOption: p.isOption,
      option: p.option || []
    }))

    const buffer = await downloadProductTemplate(
      categories,
      productsWithCategory
    )

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=template_produk.xlsx'
    )

    res.send(buffer)
  } catch (err) {
    console.error('Error downloading template:', err)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengunduh template',
      error: err.message
    })
  }
}

// Import Product from Excel Template
exports.importProduct = async (req, res) => {
  const { storeId } = req.body

  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'File Excel diperlukan'
    })
  }

  try {
    const products = await parseProductTemplate(req.file.buffer)

    if (!products.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Data produk tidak ditemukan di file Excel'
      })
    }

    const imageFiles = req.files || []
    const imageMap = {}
    imageFiles.forEach((file) => {
      const baseName = file.originalname.replace(/\.[^/.]+$/, '').toLowerCase()
      imageMap[baseName] = file.path
    })

    const categories = await Category.findAll({
      where: { store: storeId },
      attributes: ['id', 'name']
    })
    const categoryMap = categories.reduce((acc, cat) => {
      acc[cat.name.toLowerCase()] = cat.id
      return acc
    }, {})

    const results = {
      created: [],
      updated: [],
      errors: []
    }

    for (const product of products) {
      try {
        if (!product.nameProduct) {
          results.errors.push({
            no: product.no,
            message: 'Nama produk kosong'
          })
          continue
        }

        const categoryId = product.category
          ? categoryMap[product.category.toLowerCase()]
          : null

        if (!categoryId && product.category) {
          results.errors.push({
            no: product.no,
            message: `Kategori "${product.category}" tidak ditemukan`
          })
          continue
        }

        const statusValue = product.status.toLowerCase() === 'aktif'
        const isOptionValue = product.isOption.toLowerCase() === 'ya'
        const optionsArray = product.option
          ? product.option.split(',').map((o) => o.trim())
          : []

        if (product.id) {
          const existingProduct = await Product.findOne({
            where: {
              id: product.id,
              store: storeId
            }
          })

          if (existingProduct) {
            const updateData = {
              nameProduct: product.nameProduct,
              description: product.description,
              category: categoryId,
              price: product.price,
              status: statusValue,
              isOption: isOptionValue,
              option: optionsArray
            }

            let imageUrl = product.image

            const productFileName = product.nameProduct
              .toLowerCase()
              .replace(/\s+/g, '-')
            if (imageMap[productFileName]) {
              if (existingProduct.image) {
                await deleteFromCloudinary(existingProduct.image)
              }
              imageUrl = await uploadToCloudinary(
                imageMap[productFileName],
                'pos-app-products'
              )
            } else if (
              product.image &&
              product.image !== existingProduct.image
            ) {
              if (existingProduct.image) {
                await deleteFromCloudinary(existingProduct.image)
              }
              imageUrl = product.image
            }

            if (imageUrl) {
              updateData.image = imageUrl
            }

            await existingProduct.update(updateData)
            results.updated.push({
              id: product.id,
              nameProduct: product.nameProduct
            })
          } else {
            let imageUrl = product.image

            const productFileName = product.nameProduct
              .toLowerCase()
              .replace(/\s+/g, '-')
            if (imageMap[productFileName]) {
              imageUrl = await uploadToCloudinary(
                imageMap[productFileName],
                'pos-app-products'
              )
            }

            const newProduct = await Product.create({
              id: product.id,
              nameProduct: product.nameProduct,
              image: imageUrl || null,
              description: product.description,
              category: categoryId,
              price: product.price,
              status: statusValue,
              isOption: isOptionValue,
              option: optionsArray,
              store: storeId
            })
            results.created.push({
              id: newProduct.id,
              nameProduct: newProduct.nameProduct
            })
          }
        } else {
          let imageUrl = product.image

          const productFileName = product.nameProduct
            .toLowerCase()
            .replace(/\s+/g, '-')
          if (imageMap[productFileName]) {
            imageUrl = await uploadToCloudinary(
              imageMap[productFileName],
              'pos-app-products'
            )
          }

          const newProduct = await Product.create({
            nameProduct: product.nameProduct,
            image: imageUrl || null,
            description: product.description,
            category: categoryId,
            price: product.price,
            status: statusValue,
            isOption: isOptionValue,
            option: optionsArray,
            store: storeId
          })
          results.created.push({
            id: newProduct.id,
            nameProduct: newProduct.nameProduct
          })
        }
      } catch (err) {
        results.errors.push({
          no: product.no,
          message: err.message
        })
      }
    }

    res.status(200).json({
      status: 'success',
      message: `Berhasil import ${results.created.length} produk baru dan ${results.updated.length} produk diupdate`,
      data: results
    })
  } catch (err) {
    console.error('Error importing products:', err)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengimport produk',
      error: err.message
    })
  }
}
