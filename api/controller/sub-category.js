const db = require('../../db/models')
const SubCategoryProduct = db.sub_category
const Category = db.category

exports.getAllSubCategory = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, pageSize = 10 } = req.query

  try {
    const offset = (page - 1) * pageSize

    const subCategory = await SubCategoryProduct.findAll({
      where: store ? { store } : {},
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    })

    const resolvedSubCategories = await Promise.all(
      subCategory.map(async (items) => {
        const categoryData = await Category.findOne({
          where: {
            id: items.dataValues.idParentCategory
          }
        })

        return {
          ...items.dataValues,
          nameCategory: categoryData ? categoryData.name : null
        }
      })
    )

    const responseData = resolvedSubCategories.map((items) => {
      return {
        ...items,
        typeSubCategory: JSON?.parse(items?.typeSubCategory)
      }
    })

    const totalSubCategories = await SubCategoryProduct.count({
      where: store ? { store } : {}
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: responseData.length > 0 ? responseData : [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalSubCategories,
        totalPages: Math.ceil(totalSubCategories / pageSize)
      }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.postNewSubCategory = async (req, res) => {
  const {
    parentCategory,
    nameSubCategory,
    typeSubCategory,
    isMultiple,
    createdBy
  } = req.body
  const store = req.body.store || req.user?.store
  try {
    const postData = SubCategoryProduct.create({
      idParentCategory: parentCategory,
      nameSubCategory: nameSubCategory,
      typeSubCategory: typeSubCategory,
      isMultiple: isMultiple,
      store: store,
      createdBy: createdBy
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: postData
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getSubcategoryByCategory = async (req, res) => {
  const { idParentCategory } = req.query
  const store = req.query.store || req.user?.store
  try {
    const getSubAllCategory = await SubCategoryProduct.findAll({
      where: { idParentCategory: idParentCategory, ...(store ? { store } : {}) }
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getSubAllCategory.map((items) => ({ ...items.dataValues }))
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editSubcategoryById = async (req, res) => {
  const {
    id,
    parentCategory,
    nameSubCategory,
    typeSubCategory,
    isMultiple,
    createdBy,
    modifiedBy
  } = req.body
  const store = req.body.store || req.user?.store
  try {
    const editSubCategory = await SubCategoryProduct?.update(
      {
        idParentCategory: parentCategory,
        nameSubCategory: nameSubCategory,
        typeSubCategory: typeSubCategory,
        isMultiple: isMultiple,
        createdBy: createdBy,
        modifiedBy: modifiedBy
      },
      {
        returning: true,
        where: {
          id: id,
          ...(store ? { store } : {})
        }
      }
    ).then(([_, data]) => {
      return data
    })

    return res.status(200).json({
      success: true,
      message: 'Sukses Ubah Sub Category',
      data: editSubCategory?.dataValues
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteSubcategoryById = async (req, res) => {
  const body = req.body

  try {
    const store = body.store || req.user?.store
    const getId = await SubCategoryProduct.destroy({
      where: {
        id: body.id,
        ...(store ? { store } : {})
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Sub Category'
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Hapus Category Gagal'
      })
    }
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}