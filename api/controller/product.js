/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
// Connect DB
const Product = require('../../db/models/product')
const Category = require('../../db/models/category')
const SubCategoryProduct = require('../../db/models/sub_category')
const { compareProduct } = require('../../utils/compare-value')
const { Op } = require('sequelize')

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
    const postData = await Product.create({
      nameProduct: nameProduct,
      category: category,
      description: description,
      price: price,
      status: status,
      isOption: isOption,
      option: isOption ? option : [],
      createdBy: createdBy,
      image: image,
      store: store
    })

    return res.status(200).json({
      status: 'success',
      data: postData
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

// Render Edit Form Product
exports.editProductByLocationAndId = async (req, res, next) => {
  const {
    id,
    nameProduct,
    category,
    status,
    description,
    price,
    createdBy,
    image,
    option,
    isOption,
    store,
    modifiedBy
  } = req.body
  try {
    const getAllProductByIdAndLocation = await Product.findOne({
      where: {
        id: id,
        store: store
      }
    })

    const reqBody = {
      nameProduct: nameProduct,
      image: image,
      category: category,
      description: description,
      price: price,
      isOption: isOption,
      option: option,
      status: status,
      store: store
    }

    const duplicateData = {
      nameProduct: getAllProductByIdAndLocation.nameProduct,
      image: getAllProductByIdAndLocation.image,
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
      const editLocation = await Product?.update(
        {
          nameProduct: nameProduct,
          image: image,
          category: category,
          description: description,
          price: price,
          isOption: isOption,
          option: option,
          status: status,
          store: store
        },
        {
          returning: true,
          where: {
            id: id
          }
        }
      ).then(([_, data]) => {
        return data
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
