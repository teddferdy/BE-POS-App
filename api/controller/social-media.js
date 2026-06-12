const db = require('../../db/models')
const { createAudit } = require('../../utils/auditLog')
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
        icon: body.icon,
        link: body.link,
        status: body.status || 'active',
        createdBy: body.createdBy,
        store: store
      })

      if (creadtedCategory.getDataValue) {
        await createAudit(
          req,
          'create',
          'social_media_config',
          creadtedCategory.id,
          'Created social_media_config: ' + creadtedCategory.id
        )

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
  const { id } = req.params
  const body = req.body
  try {
    const store = body.store || req.user?.store
    const getDuplicate = await SocialMedia.findOne({
      where: {
        name: body.name,
        ...(store ? { store } : {}),
        id: { [db.Sequelize.Op.ne]: id }
      }
    })

    if (!getDuplicate?.dataValues) {
      const [updated] = await SocialMedia?.update(
        {
          name: body?.name,
          icon: body?.icon,
          link: body?.link,
          status: body?.status
        },
        {
          where: {
            id,
            ...(store ? { store } : {})
          }
        }
      )

      if (updated) {
        await createAudit(
          req,
          'update',
          'social_media_config',
          id,
          'Updated social_media_config: ' + id
        )
      }

      return res.status(200).json({
        success: true,
        message: 'Sukses Ubah Social Media'
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
  const { id } = req.params
  const body = req.body

  try {
    const store = body.store || req.user?.store
    const getId = await SocialMedia.destroy({
      where: {
        id,
        ...(store ? { store } : {})
      }
    })

    if (getId) {
      await createAudit(
        req,
        'delete',
        'social_media_config',
        id,
        'Deleted social_media_config: ' + id
      )

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
