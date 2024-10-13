/* eslint-disable no-unused-vars */
/* eslint-disable no-unsafe-finally */
const Product = require('../../db/models/product')
const BestSelling = require('../../db/models/best_selling')
const Category = require('../../db/models/category')
const Location = require('../../db/models/location')
const Member = require('../../db/models/member')
const User = require('../../db/models/user')

// get Product
exports.getProduct = async (req, res, next) => {
  try {
    const getAllProduct = await Product.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    // Get By True
    const getAllByTrue = await Product.findAll({
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

    // Get By False
    const getAllByFalse = await Product.findAll({
      where: {
        status: false
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
      data: {
        total: getAllProduct?.length || 0,
        active: getAllByTrue?.length || 0,
        notActive: getAllByFalse?.length || 0
      }
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

// get Category
exports.getCategory = async (req, res, next) => {
  try {
    const getAllCategory = await Category.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    // Get By True
    const getAllByTrue = await Category.findAll({
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

    // Get By False
    const getAllByFalse = await Category.findAll({
      where: {
        status: false
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
      data: {
        total: getAllCategory?.length || 0,
        active: getAllByTrue?.length || 0,
        notActive: getAllByFalse?.length || 0
      }
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

// Get Location
exports.getLocation = async (req, res, next) => {
  try {
    const getAllLocation = await Location.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    // Get By True
    const getAllByTrue = await Location.findAll({
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

    // Get By False
    const getAllByFalse = await Location.findAll({
      where: {
        status: false
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
      data: {
        total: getAllLocation?.length || 0,
        active: getAllByTrue?.length || 0,
        notActive: getAllByFalse?.length || 0
      }
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

// Get Member
exports.getMember = async (req, res, next) => {
  try {
    const getAllMember = await Member.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      message: 'Success',
      data: {
        total: getAllMember.length || 0
      }
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

// Get User
exports.getUser = async (req, res, next) => {
  try {
    const getAllUser = await User.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      message: 'Success',
      data: {
        total: getAllUser.length || 0
      }
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

// Get Best Selling By Count
exports.getBestSellingByCount = async (req, res, next) => {
  const { store } = req.query
  try {
    const getAllBestSelling = await BestSelling.findAll({
      order: [['totalSelling', 'DESC']],
      where: {
        store: store
      },
      limit: 5
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
      data: getAllBestSelling?.length > 0 ? getAllBestSelling : []
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Get Member List By Descending / Latest
exports.getMemberDescending = async (req, res, next) => {
  const { store } = req.query

  try {
    const getAllMember = await Member.findAll({
      order: [['id', 'DESC']],
      where: {
        store: store
      },
      limit: 5
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
      data: getAllMember
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

// get Category List By Descending / Latest
exports.getCategoryDescending = async (req, res, next) => {
  const { store } = req.query

  try {
    const getAllCategory = await Category.findAll({
      order: [['id', 'DESC']],
      where: {
        store: store
      },
      limit: 5
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
      data: getAllCategory
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

// Get Location List By Descending / Latest
exports.getLocationDescending = async (req, res, next) => {
  try {
    const getAllLocation = await Location.findAll({
      order: [['id', 'DESC']],
      limit: 5
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
      data: getAllLocation
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

// Get Product List By Descending / Latest
exports.getProductDescending = async (req, res, next) => {
  const { store } = req.query

  try {
    const getAllProduct = await Product.findAll({
      order: [['id', 'DESC']],
      where: {
        store: store
      },
      limit: 5
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
      data: getAllProduct
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
