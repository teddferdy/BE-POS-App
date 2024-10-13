/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const Location = require('../../db/models/location')
// Need Update
const User = require('../../db/models/user')
const BestSelling = require('../../db/models/best_selling')
const Checkout = require('../../db/models/checkout')
const Product = require('../../db/models/product')
const Category = require('../../db/models/category')
const SubCategoryProduct = require('../../db/models/sub_category')
const Discount = require('../../db/models/discount')
const InvoiceFooter = require('../../db/models/invoice_footer')
const InvoiceLogo = require('../../db/models/invoice_logo')
const InvoiceSocialMedia = require('../../db/models/invoice_social_media')
const Member = require('../../db/models/member')
const SocialMedia = require('../../db/models/social_media')
const TypePayment = require('../../db/models/type_payment')
const Transaction = require('../../db/models/transaction')
const Shift = require('../../db/models/shift')

const { compareObjects } = require('../../utils/compare-value')

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
        image: body.image,
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

exports.editLocationById = async (req, res, next) => {
  const body = req.body
  const { confirmUserUpdate } = body

  try {
    // Check for an existing store with the same name
    const getDuplicate = await Location.findOne({
      where: { nameStore: body.nameStore }
    })

    // Check if users are associated with the old store name
    const checkUser = await User.findAll({
      where: { location: body.oldStoreName }
    })

    // If users exist and confirmUserUpdate is not provided, prompt for confirmation
    if (checkUser.length > 0 && !confirmUserUpdate) {
      return res.status(200).json({
        message:
          'Users are already associated with this store. Do you want to update their store assignment?',
        showUserUpdateDialog: true
      })
    }

    // If confirmation is given, update user location to the new store name
    if (confirmUserUpdate) {
      await User.update(
        { location: body.nameStore },
        { where: { location: body.oldStoreName } }
      )
    }

    // Prepare the new location data for the update
    const bodyReq = {
      id: body?.id,
      image: body.image,
      nameStore: body?.nameStore,
      address: body?.address,
      detailLocation: body?.detailLocation,
      phoneNumber: body?.phoneNumber,
      status: body?.status
    }

    // Check if there are existing records with the same store name
    const dataExist = getDuplicate
      ? {
          id: getDuplicate.dataValues.id,
          image: getDuplicate.dataValues.image,
          nameStore: getDuplicate.dataValues.nameStore,
          address: getDuplicate.dataValues.address,
          detailLocation: getDuplicate.dataValues.detailLocation,
          phoneNumber: getDuplicate.dataValues.phoneNumber,
          status: getDuplicate.dataValues.status
        }
      : null

    // Compare the old and new data to determine if changes are necessary
    const resultValue = compareObjects(dataExist, bodyReq)

    if (resultValue) {
      return res.status(403).json({
        message: 'The location already exists.'
      })
    }

    // Update the location in the Location table
    const editLocation = await Location.update(
      {
        id: body.id,
        image: body.image,
        nameStore: body.nameStore,
        address: body.address,
        detailLocation: body.detailLocation,
        phoneNumber: body.phoneNumber,
        status: body.status,
        createdBy: body.createdBy,
        modifiedBy: body.modifiedBy
      },
      { returning: true, where: { id: body.id } }
    ).then(([_, data]) => data)

    // If the store status is inactive, update associated records one by one and check if there's data to update
    if (body.status === false) {
      const modelsToUpdate = [
        {
          model: User,
          field: 'location',
          value: body.nameStore,
          updateFields: { statusActive: false }
        },
        {
          model: Product,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: Transaction,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: BestSelling,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: Checkout,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: Category,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: SubCategoryProduct,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: Discount,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: InvoiceFooter,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: InvoiceLogo,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: InvoiceSocialMedia,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: Member,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: SocialMedia,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: TypePayment,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        },
        {
          model: Shift,
          field: 'store',
          value: body.nameStore,
          updateFields: { status: false }
        }
      ]

      for (const { model, field, value, updateFields } of modelsToUpdate) {
        const record = await model.findOne({ where: { [field]: value } })
        if (record) {
          await model.update(updateFields, { where: { [field]: value } })
        }
      }
    }

    // If the store status is active and the nameStore has changed, update location/store fields for all related records
    if (body.status === true && body.nameStore !== body.oldStoreName) {
      const modelsToUpdate = [
        {
          model: User,
          field: 'location',
          value: body.oldStoreName,
          updateFields: { location: body.nameStore }
        },
        {
          model: Product,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: Transaction,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: BestSelling,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: Checkout,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: Category,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: SubCategoryProduct,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: Discount,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: InvoiceFooter,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: InvoiceLogo,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: InvoiceSocialMedia,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: Member,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: SocialMedia,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: TypePayment,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        },
        {
          model: Shift,
          field: 'store',
          value: body.oldStoreName,
          updateFields: { store: body.nameStore }
        }
      ]

      for (const { model, field, value, updateFields } of modelsToUpdate) {
        const record = await model.findOne({ where: { [field]: value } })
        if (record) {
          await model.update(updateFields, { where: { [field]: value } })
        }
      }
    }

    return res.status(200).json({
      message: 'Successfully updated location.',
      data: editLocation?.dataValues
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error'
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
