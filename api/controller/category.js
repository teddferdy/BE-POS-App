/* eslint-disable no-unused-vars */
const Category = require('../../db/models/category')

// Get All List
exports.getAllCategory = async (req, res, next) => {
  try {
    const getAllCategory = await Category.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      message: 'Success',
      data:
        getAllCategory?.length > 0 ? getAllCategory : 'Kategori Masih Kosong'
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Add New Category
exports.addNewCategory = async (req, res, next) => {
  const body = req.body

  try {
    const findOneCategory = await Category?.findOne({
      where: {
        name: body?.name
      }
    })

    if (!findOneCategory?.getDataValue) {
      const creadtedCategory = await Category.create({
        name: body.name,
        value: body.value,
        status: body.status,
        createdBy: body.createdBy
      })

      if (creadtedCategory.getDataValue) {
        return res.status(200).json({
          message: 'Category Berhasil Di Buat'
        })
      }
    } else {
      return res.status(403).json({
        message: 'Category Sudah Terdaftar'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Edit Category By Id
exports.editCategoryById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await Category.findOne({
      where: {
        name: body.name
      }
    })

    if (!getDuplicate?.dataValues) {
      const editCategory = await Category?.update(
        {
          id: body?.id,
          name: body?.name,
          value: body?.value,
          status: body?.status,
          createdBy: body?.createdBy,
          modifiedBy: body?.modifiedBy,
          modifiedAt: body?.modifiedAt
        },
        {
          returning: true,
          where: {
            id: body.id
          }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        message: 'Sukses Ubah Kategori',
        data: editCategory?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Kategori Sudah Tersedia'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Delete Category By Id
exports.deleteCategoryById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await Category.destroy({
      where: {
        id: body.id,
        name: body.name
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Kategori'
      })
    } else {
      return res.status(403).json({
        message: 'Gagal Hapus Kategori'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
