const db = require('../../db/models')
const SocialMedia = db.social_media

exports.getAllSocialMedia = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, size = 10 } = req.query
  const limit = parseInt(size)
  const offset = (parseInt(page) - 1) * limit

  try {
    const { count, rows: getAllCategory } = await SocialMedia.findAndCountAll({
      where: store ? { store } : {},
      limit: limit,
      offset: offset
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: getAllCategory?.length > 0 ? getAllCategory : []
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.addNewSocialMedia = async (req, res) => {
  const body = req.body

  try {
    const store = body.store || req.user?.store
    const findOneSocialMedia = await SocialMedia?.findOne({
      where: {
        name: body?.name,
        ...(store ? { store } : {})
      }
    })

    if (!findOneSocialMedia?.getDataValue) {
      const creadtedCategory = await SocialMedia.create({
        name: body.name,
        createdBy: body.createdBy,
        store: store
      })

      if (creadtedCategory.getDataValue) {
        return res.status(200).json({
          success: true,
          message: 'Social Media Berhasil Di Buat'
        })
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Social Media Sudah Terdaftar'
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editSocialMediaById = async (req, res) => {
  const body = req.body
  try {
    const store = body.store || req.user?.store
    const getDuplicate = await SocialMedia.findOne({
      where: {
        name: body.name,
        ...(store ? { store } : {})
      }
    })

    if (!getDuplicate?.dataValues) {
      const editCategory = await SocialMedia?.update(
        {
          id: body?.id,
          name: body?.name
        },
        {
          returning: true,
          where: {
            id: body.id,
            ...(store ? { store } : {})
          }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        success: true,
        message: 'Sukses Ubah Social Media',
        data: editCategory?.dataValues
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Social Media Sudah Tersedia'
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteSocialMediaById = async (req, res) => {
  const body = req.body

  try {
    const store = body.store || req.user?.store
    const getId = await SocialMedia.destroy({
      where: {
        id: body.id,
        name: body.name,
        ...(store ? { store } : {})
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Social Media'
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Gagal Hapus Social Media'
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}