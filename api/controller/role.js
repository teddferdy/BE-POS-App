/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const Role = require('../../db/models/role')

// Get All List To Dropdown
exports.getAllRole = async (req, res, next) => {
  try {
    const getAllRole = await Role.findAll({
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
      data: getAllRole?.length > 0 ? getAllRole : []
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

// Get All Role To Table
exports.getAllRoleInTable = async (req, res, next) => {
  try {
    // Extract query parameters for pagination and status filtering
    const { page = 1, limit = 10, status = 'all' } = req.query
    const offset = (page - 1) * limit
    const whereCondition = {}

    // Set where condition based on status
    if (status === 'true') {
      whereCondition.status = true
    } else if (status === 'false') {
      whereCondition.status = false
    }

    // Fetch roles with pagination and filtering
    const { rows: roles, count: totalRoles } = await Role.findAndCountAll({
      where: whereCondition,
      offset: parseInt(offset),
      limit: parseInt(limit)
    })

    // Transform data (if needed)
    const getAllRole = roles.map((items) => {
      return { ...items.dataValues }
    })

    return res.status(200).json({
      message: 'Success',
      data: getAllRole.length > 0 ? getAllRole : [],
      pagination: {
        total: totalRoles,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRoles / limit)
      }
    })
  } catch (error) {
    console.log('Error =>', error)

    return res.status(500).json({
      error: 'Internal Server Error'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Add New Role
exports.addNewRole = async (req, res, next) => {
  const body = req.body

  try {
    const findOneRole = await Role?.findOne({
      where: {
        name: body?.name
      }
    })

    if (!findOneRole?.getDataValue) {
      const creadtedRole = await Role.create({
        name: body.name,
        description: body.description,
        status: body.status,
        createdBy: body.createdBy
      })

      if (creadtedRole.getDataValue) {
        return res.status(200).json({
          message: 'Role Berhasil Di Buat'
        })
      }
    } else {
      return res.status(403).json({
        message: 'Role Sudah Terdaftar'
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

// Edit Role By Id
exports.editRoleById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await Role.findOne({
      where: {
        name: body.name
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === body?.status
    ) {
      const editRole = await Role?.update(
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
        message: 'Sukses Ubah Role',
        data: editRole?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Role Sudah Tersedia'
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

// Delete Role By Id
exports.deleteRoleById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await Role.destroy({
      where: {
        id: body.id,
        name: body.name
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Role'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Role Gagal'
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
