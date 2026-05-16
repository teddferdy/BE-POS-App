const db = require('../../db/models')
const Role = db.role
const { Op } = db.Sequelize

exports.getAllRole = async (req, res) => {
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
      success: true,
      message: 'Success',
      data: getAllRole?.length > 0 ? getAllRole : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllRoleInTable = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query
    const offset = (page - 1) * limit
    const whereCondition = {}

    if (status === 'true') {
      whereCondition.status = true
    } else if (status === 'false') {
      whereCondition.status = false
    }

    const { rows: roles, count: totalRoles } = await Role.findAndCountAll({
      where: whereCondition,
      offset: parseInt(offset),
      limit: parseInt(limit)
    })

    const getAllRole = roles.map((items) => {
      return { ...items.dataValues }
    })

    return res.status(200).json({
      success: true,
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
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    })
  }
}

exports.addNewRole = async (req, res) => {
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
          success: true,
          message: 'Role Berhasil Di Buat'
        })
      }
    }
    return res.status(403).json({
      success: false,
      message: 'Role Sudah Terdaftar'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editRoleById = async (req, res) => {
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
        success: true,
        message: 'Sukses Ubah Role',
        data: editRole?.dataValues
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Role Sudah Tersedia'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteRoleById = async (req, res) => {
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
        success: true,
        message: 'Success Hapus Role'
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Hapus Role Gagal'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getRoleById = async (req, res) => {
  const { id } = req.params

  try {
    const role = await Role.findByPk(id)

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role Tidak Ditemukan'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: role
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.updateUserRole = async (req, res) => {
  const { userId, roleId, accessMenu } = req.body
  const currentUserRole = req.user?.roleType

  try {
    const user = await db.user.findByPk(userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Tidak Ditemukan'
      })
    }

    const role = await Role.findByPk(roleId)

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role Tidak Ditemukan'
      })
    }

    if (user.roleType === 'super_admin' && role.roleType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Tidak dapat downgrade Super Admin'
      })
    }

    if (currentUserRole === 'admin' && (user.roleType === 'super_admin' || role.roleType === 'super_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengubah role Super Admin'
      })
    }

    if (currentUserRole === 'admin' && role.roleType === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Tidak dapat memberikan role Super Admin'
      })
    }

    if (currentUserRole === 'admin') {
      if (user.store !== req.user.store) {
        return res.status(403).json({
          success: false,
          message: 'Anda hanya dapat mengelola user di toko Anda'
        })
      }
    }

    await user.update({
      roleType: role.roleType,
      roleId: roleId,
      accessMenu: accessMenu || role.accessMenu
    })

    return res.status(200).json({
      success: true,
      message: 'Success Ubah Role User',
      data: {
        id: user.id,
        userName: user.userName,
        roleType: user.roleType,
        roleId: user.roleId,
        accessMenu: user.accessMenu
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

exports.getUsersByRole = async (req, res) => {
  const { roleType } = req.query
  const currentUserRole = req.user?.roleType
  const currentUserStore = req.user?.store

  try {
    const whereCondition = {}

    if (roleType) {
      whereCondition.roleType = roleType
    }

    if (currentUserRole === 'admin') {
      whereCondition.store = currentUserStore
      whereCondition.roleType = { [Op.ne]: 'super_admin' }
    }

    const users = await db.user.findAll({
      where: whereCondition,
      attributes: { exclude: ['password'] },
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name', 'roleType', 'accessMenu'] }
      ]
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: users
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.updateRoleAccessMenu = async (req, res) => {
  const { roleId, accessMenu } = req.body

  try {
    const role = await Role.findByPk(roleId)

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role Tidak Ditemukan'
      })
    }

    await role.update({ accessMenu: accessMenu })

    return res.status(200).json({
      success: true,
      message: 'Success Update Akses Menu',
      data: {
        id: role.id,
        name: role.name,
        roleType: role.roleType,
        accessMenu: role.accessMenu
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