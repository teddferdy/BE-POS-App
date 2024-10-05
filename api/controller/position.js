/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const Position = require('../../db/models/position')

// Get All List To Dropdown
exports.getAllPosition = async (req, res, next) => {
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
      message: 'Success',
      data: getAllPosition?.length > 0 ? getAllPosition : []
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

// Get All Position To Table
exports.getAllPositionInTable = async (req, res, next) => {
  try {
    const getAllPosition = await Position.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      message: 'Success',
      data: getAllPosition?.length > 0 ? getAllPosition : []
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

// Add New Position
exports.addNewPosition = async (req, res, next) => {
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
          message: 'Position Berhasil Di Buat'
        })
      }
    } else {
      return res.status(403).json({
        message: 'Position Sudah Terdaftar'
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

// Edit Position By Id
exports.editPositionById = async (req, res, next) => {
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
        message: 'Sukses Ubah Position',
        data: editPosition?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Position Sudah Tersedia'
      })
    }
  } catch (error) {
    console.log(error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Delete Position By Id
exports.deletePositionById = async (req, res, next) => {
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
        message: 'Success Hapus Position'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Position Gagal'
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
