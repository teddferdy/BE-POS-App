const db = require('../../db/models')
const Position = db.position

exports.getAllPosition = async (req, res) => {
  try {
    const getAllPosition = await Position.findAll({
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
      success: true,
      message: 'Success',
      data: getAllPosition?.length > 0 ? getAllPosition : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllPositionInTable = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query
    const offset = (page - 1) * limit

    let whereCondition = {}
    if (status === 'true') {
      whereCondition = { status: true }
    } else if (status === 'false') {
      whereCondition = { status: false }
    }

    const { rows: getAllPosition, count: totalItems } = await Position.findAndCountAll({
      where: whereCondition,
      offset: parseInt(offset),
      limit: parseInt(limit)
    })

    const totalPages = Math.ceil(totalItems / limit)

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllPosition?.length > 0 ? getAllPosition : [],
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
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

exports.addNewPosition = async (req, res) => {
  const body = req.body

  try {
    const findOnePosition = await Position?.findOne({
      where: {
        name: body?.name
      }
    })

    if (!findOnePosition?.getDataValue) {
      const creadtedPosition = await Position.create({
        name: body.name,
        description: body.description,
        status: body.status,
        createdBy: body.createdBy
      })

      if (creadtedPosition.getDataValue) {
        return res.status(200).json({
          success: true,
          message: 'Position Berhasil Di Buat'
        })
      }
    }
    return res.status(403).json({
      success: false,
      message: 'Position Sudah Terdaftar'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editPositionById = async (req, res) => {
  const body = req.body
  try {
    const getDuplicate = await Position.findOne({
      where: {
        name: body.name
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === body?.status
    ) {
      const editPosition = await Position?.update(
        {
          id: body?.id,
          name: body.name,
          description: body.description,
          status: body.status,
          createdBy: body?.createdBy,
          modifiedBy: body?.modifiedBy
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
        success: true,
        message: 'Sukses Ubah Position',
        data: editPosition?.dataValues
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Position Sudah Tersedia'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deletePositionById = async (req, res) => {
  const body = req.body

  try {
    const getId = await Position.destroy({
      where: {
        id: body.id,
        name: body.name
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Position'
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Hapus Position Gagal'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}