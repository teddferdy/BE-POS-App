const db = require('../../db/models')
const Role = db.role
const User = db.user
const { Op } = db.Sequelize
const { createAudit } = require('../../utils/auditLog')

exports.getAllRole = async (req, res) => {
  try {
    const getAllRole = await Role.findAll({
      where: {
        status: 'active'
      },
      order: [['createdAt', 'DESC']]
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
    const { page = 1, limit = 10, status = 'all', search } = req.query
    const offset = (page - 1) * limit
    const whereCondition = {}

    if (status === 'active' || status === 'true') {
      whereCondition.status = 'active'
    } else if (status === 'inactive' || status === 'false') {
      whereCondition.status = 'inactive'
    }

    if (search) whereCondition.name = { [Op.iLike]: `%${search}%` }

    const { rows: roles, count: totalRoles } = await Role.findAndCountAll({
      where: whereCondition,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    })

    const getAllRole = roles.map((items) => {
      return { ...items.dataValues }
    })

    const [activeCount, draftCount, inactiveCount] = await Promise.all([
      Role.count({ where: { status: 'active' } }),
      Role.count({ where: { status: 'draft' } }),
      Role.count({ where: { status: 'inactive' } })
    ])

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllRole.length > 0 ? getAllRole : [],
      pagination: {
        total: totalRoles,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRoles / limit)
      },
      stats: {
        total: activeCount + draftCount + inactiveCount,
        active: activeCount,
        draft: draftCount,
        inactive: inactiveCount
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
        status:
          body.status !== undefined
            ? body.status === true
              ? 'active'
              : body.status === false
                ? 'inactive'
                : body.status
            : 'active',
        accessMenu: body.accessMenu || []
      })

      createAudit(
        req,
        'create',
        'role',
        creadtedRole.id,
        `Created role: ${creadtedRole.id}`
      )

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
        name: body.name,
        id: { [Op.ne]: req.params.id }
      }
    })

    const bodyStatus =
      body.status !== undefined
        ? body.status === true
          ? 'active'
          : body.status === false
            ? 'inactive'
            : body.status
        : 'active'

    if (
      !getDuplicate?.dataValues ||
      getDuplicate?.dataValues?.status !== bodyStatus
    ) {
      const editRole = await Role?.update(
        {
          name: body.name,
          description: body.description,
          status:
            body.status !== undefined
              ? body.status === true
                ? 'active'
                : body.status === false
                  ? 'inactive'
                  : body.status
              : 'active',
          accessMenu: body.accessMenu || [],
          modifiedBy: body?.modifiedBy
        },
        {
          returning: true,
          where: {
            id: req.params.id
          }
        }
      ).then(([_, data]) => {
        return data
      })

      createAudit(
        req,
        'update',
        'role',
        req.params.id,
        `Updated role: ${req.params.id}`
      )

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
  try {
    const role = await Role.findByPk(req.params.id)
    if (role?.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Role system tidak dapat dihapus'
      })
    }

    // Clean up user.roleId references for affected users
    await User.update({ roleId: null }, { where: { roleId: req.params.id } })

    const getId = await Role.destroy({
      where: {
        id: req.params.id
      }
    })

    if (getId) {
      createAudit(
        req,
        'delete',
        'role',
        req.params.id,
        `Deleted role: ${req.params.id}`
      )

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

    if (
      currentUserRole === 'admin' &&
      (user.roleType === 'super_admin' || role.roleType === 'super_admin')
    ) {
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

    createAudit(req, 'update', 'role', roleId, `Updated user role: ${userId}`)

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
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'roleType', 'accessMenu']
        }
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

    createAudit(
      req,
      'update',
      'role',
      roleId,
      `Updated role access menu: ${roleId}`
    )

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
