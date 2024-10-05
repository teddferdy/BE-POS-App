/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const Location = require('../../db/models/location')

// Get All List To Dropdown
exports.getAllLocation = async (req, res, next) => {
  try {
    const getAllLocation = await Location.findAll({
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
      data: getAllLocation?.length > 0 ? getAllLocation : []
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

// Get All Location To Table
exports.getAllLocationInTable = async (req, res, next) => {
  try {
    const getAllLocation = await Location.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      message: 'Success',
      data: getAllLocation?.length > 0 ? getAllLocation : []
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

// Add New Location
exports.addNewLocation = async (req, res, next) => {
  const body = req.body

  try {
    const findOneLocation = await Location?.findOne({
      where: {
        nameStore: body?.nameStore
      }
    })

    if (!findOneLocation?.getDataValue) {
      const creadtedLocation = await Location.create({
        nameStore: body.nameStore,
        address: body.address,
        detailLocation: body.detailLocation,
        phoneNumber: body.phoneNumber,
        status: body.status,
        createdBy: body.createdBy
      })

      if (creadtedLocation.getDataValue) {
        return res.status(200).json({
          message: 'Location Berhasil Di Buat'
        })
      }
    } else {
      return res.status(403).json({
        message: 'Location Sudah Terdaftar'
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

// Edit Location By Id
exports.editLocationById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await Location.findOne({
      where: {
        nameStore: body.nameStore
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === body?.status
    ) {
      const editLocation = await Location?.update(
        {
          id: body?.id,
          nameStore: body?.nameStore,
          address: body?.address,
          detailLocation: body?.detailLocation,
          phoneNumber: body?.phoneNumber,
          status: body?.status,
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
        message: 'Sukses Ubah Lokasi',
        data: editLocation?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Lokasi Sudah Tersedia'
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

// Delete Location By Id
exports.deleteLocationById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await Location.destroy({
      where: {
        id: body.id,
        nameStore: body.nameStore
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Lokasi'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Lokasi Gagal'
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
