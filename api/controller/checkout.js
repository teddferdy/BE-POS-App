/* eslint-disable no-unused-vars */
// const Location = require('../../db/models/location')

// Checkout
exports.checkout = async (req, res, next) => {
  const body = req.body

  try {
    console.log('REQ =>', req.app)

    // const findOneLocation = await Location?.findOne({
    //   where: {
    //     nameStore: body?.nameStore
    //   }
    // })

    // if (!findOneLocation?.getDataValue) {
    //   const creadtedLocation = await Location.create({
    //     nameStore: body.nameStore,
    //     address: body.address,
    //     detailLocation: body.detailLocation,
    //     phoneNumber: body.phoneNumber,
    //     status: body.status,
    //     createdBy: body.createdBy
    //   })

    //   if (creadtedLocation.getDataValue) {
    //     return res.status(200).json({
    //       message: 'Location Berhasil Di Buat'
    //     })
    //   }
    // } else {
    //   return res.status(403).json({
    //     message: 'Location Sudah Terdaftar'
    //   })
    // }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
