const db = require('../../db/models')
const Department = db.department

exports.getAllDepartment = async (req, res) => {
  try {
    const getAllDepartment = await Department.findAll({
      where: { status: true }
    }).then((res) =>
      res.map((items) => {
        const getData = { ...items.dataValues }
        return getData
      })
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllDepartment?.length > 0 ? getAllDepartment : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllDepartmentInTable = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query
    const offset = (page - 1) * limit

    let whereCondition = {}
    if (status === 'true') {
      whereCondition = { status: true }
    } else if (status === 'false') {
      whereCondition = { status: false }
    }

    const { rows: getAllDepartment, count: totalItems } =
      await Department.findAndCountAll({
        where: whereCondition,
        offset: parseInt(offset),
        limit: parseInt(limit)
      })

    const totalPages = Math.ceil(totalItems / limit)

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllDepartment?.length > 0 ? getAllDepartment : [],
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

exports.addNewDepartment = async (req, res) => {
  const body = req.body

  try {
    const findOneDepartment = await Department?.findOne({
      where: { name: body?.name }
    })

    if (!findOneDepartment?.getDataValue) {
      const creadtedDepartment = await Department.create({
        name: body.name,
        description: body.description,
        status: body.status,
        createdBy: body.createdBy
      })

      if (creadtedDepartment.getDataValue) {
        return res.status(200).json({
          success: true,
          message: 'Department Berhasil Di Buat'
        })
      }
    }
    return res.status(403).json({
      success: false,
      message: 'Department Sudah Terdaftar'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editDepartmentById = async (req, res) => {
  const body = req.body
  const id = req.params.id || body.id

  try {
    const getDuplicate = await Department.findOne({
      where: {
        name: body.name,
        id: { [db.Sequelize.Op.ne]: id }
      }
    })

    if (!getDuplicate?.dataValues) {
      const editDepartment = await Department?.update(
        {
          name: body.name,
          description: body.description,
          status: body.status,
          modifiedBy: body?.modifiedBy
        },
        {
          returning: true,
          where: { id }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        success: true,
        message: 'Sukses Ubah Department',
        data: editDepartment?.dataValues
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Department Sudah Tersedia'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteDepartmentById = async (req, res) => {
  const body = req.body

  try {
    const getId = await Department.destroy({
      where: {
        id: body.id,
        name: body.name
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Department'
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Hapus Department Gagal'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
