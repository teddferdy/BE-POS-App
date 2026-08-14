const db = require('../../db/models')
const Region = db.region

const LEVEL_MAP = {
  provinces: 'province',
  regencies: 'city',
  districts: 'district',
  villages: 'village'
}

const selectAttrs = ['code', 'name', 'postalCode', 'latitude', 'longitude']

const toCanonical = (row) => ({
  code: row.code,
  name: row.name,
  ...(row.postalCode ? { postalCode: row.postalCode } : {}),
  ...(row.latitude != null ? { latitude: row.latitude } : {}),
  ...(row.longitude != null ? { longitude: row.longitude } : {})
})

const handle = (res, err) => {
  console.error('Region controller error:', err.message)
  return res.status(500).json({
    success: false,
    message: 'Terjadi Kesalahan Internal Server'
  })
}

exports.getProvince = async (req, res) => {
  try {
    const data = await Region.findAll({
      attributes: selectAttrs,
      where: { level: 'province' },
      order: [['name', 'ASC']]
    })
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: data.map(toCanonical)
    })
  } catch (err) {
    return handle(res, err)
  }
}

exports.getRegency = async (req, res) => {
  try {
    const { province_code } = req.query
    const data = await Region.findAll({
      attributes: selectAttrs,
      where: { level: 'city', parentCode: province_code },
      order: [['name', 'ASC']]
    })
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: data.map(toCanonical)
    })
  } catch (err) {
    return handle(res, err)
  }
}

exports.getDistrict = async (req, res) => {
  try {
    const { regency_code } = req.query
    const data = await Region.findAll({
      attributes: selectAttrs,
      where: { level: 'district', parentCode: regency_code },
      order: [['name', 'ASC']]
    })
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: data.map(toCanonical)
    })
  } catch (err) {
    return handle(res, err)
  }
}

exports.getVillage = async (req, res) => {
  try {
    const { district_code } = req.query
    const data = await Region.findAll({
      attributes: selectAttrs,
      where: { level: 'village', parentCode: district_code },
      order: [['name', 'ASC']]
    })
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: data.map(toCanonical)
    })
  } catch (err) {
    return handle(res, err)
  }
}

exports.getPostalCode = async (req, res) => {
  try {
    const { village_code } = req.query
    const data = await Region.findAll({
      attributes: selectAttrs,
      where: { level: 'village', code: village_code }
    })
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: data.map(toCanonical)
    })
  } catch (err) {
    return handle(res, err)
  }
}

exports.getRegion = async (req, res) => {
  try {
    const { level, parentCode, search } = req.query
    const where = {}
    if (LEVEL_MAP[level]) where.level = LEVEL_MAP[level]
    if (parentCode) where.parentCode = parentCode
    if (search) where.name = { [db.Sequelize.Op.iLike]: `%${search}%` }

    const data = await Region.findAll({
      attributes: selectAttrs,
      where,
      order: [['name', 'ASC']],
      limit: 1000
    })
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: data.map(toCanonical)
    })
  } catch (err) {
    return handle(res, err)
  }
}
