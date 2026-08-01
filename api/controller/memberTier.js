const db = require('../../db/models')
const { Op, literal } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

const memberTierController = {
  normalizeBenefits(benefits) {
    if (!Array.isArray(benefits)) return []
    return benefits
      .map((b) => (typeof b === 'string' ? b : b?.text ?? ''))
      .filter((b) => b !== '')
  },

  async getAll(req, res) {
    try {
      const { status } = req.query
      const where = {}
      if (status) {
        if (status === 'active') {
          where.status = { [Op.or]: ['active', 'true'] }
        } else if (status === 'inactive') {
          where.status = { [Op.or]: ['inactive', 'false'] }
        } else {
          where.status = status
        }
      }

      const tiers = await db.member_tier.findAll({
        where,
        attributes: {
          include: [
            [
              literal(
                '(SELECT COUNT(*) FROM "member" WHERE "member"."tier" = "member_tier"."id")'
              ),
              'memberCount'
            ]
          ]
        },
        order: [['createdAt', 'DESC']]
      })
      await enrichAuditFields(db, tiers)

      const normalizeStatus = (s) => {
        const v = String(s ?? '').toLowerCase()
        if (v === 'active' || v === 'true') return 'active'
        if (v === 'inactive' || v === 'false') return 'inactive'
        return 'draft'
      }

      const activeCount = tiers.filter(
        (t) => normalizeStatus(t.status) === 'active'
      ).length
      const draftCount = tiers.filter(
        (t) => normalizeStatus(t.status) === 'draft'
      ).length
      const inactiveCount = tiers.filter(
        (t) => normalizeStatus(t.status) === 'inactive'
      ).length
      const totalMembers = tiers.reduce(
        (sum, t) => sum + (Number(t.getDataValue('memberCount')) || 0),
        0
      )

      return res.status(200).json({
        success: true,
        message: 'Success get member tiers',
        data: tiers,
        total: tiers.length,
        activeCount,
        draftCount,
        inactiveCount,
        totalMembers
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getDetail(req, res) {
    try {
      const { id } = req.params

      const tier = await db.member_tier.findByPk(id, {
        attributes: {
          include: [
            [
              literal(
                '(SELECT COUNT(*) FROM "member" WHERE "member"."tier" = "member_tier"."id")'
              ),
              'memberCount'
            ],
            [
              literal(
                '(SELECT "fullName" FROM "user" WHERE "user"."id" = "member_tier"."createdBy")'
              ),
              'createdByName'
            ],
            [
              literal(
                '(SELECT "fullName" FROM "user" WHERE "user"."id" = "member_tier"."modifiedBy")'
              ),
              'modifiedByName'
            ]
          ]
        }
      })

      if (!tier) {
        return res.status(404).json({
          success: false,
          message: 'Member tier not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get member tier detail',
        data: tier
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async create(req, res) {
    try {
      const {
        name,
        minPoints,
        maxPoints,
        discountPercent,
        pointMultiplier,
        benefits,
        color,
        status
      } = req.body
      const createdBy = req.user?.id || null

      if (!name && status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const tier = await db.member_tier.create({
        name,
        minPoints: minPoints || 0,
        maxPoints: maxPoints ?? 0,
        discountPercent: discountPercent || 0,
        pointMultiplier: pointMultiplier || 1.0,
        benefits: memberTierController.normalizeBenefits(benefits),
        color: color || '#000000',
        status: status !== undefined ? status : 'active',
        createdBy
      })
      createAudit(
        req,
        'create',
        'member_tier',
        tier.id,
        'Created member_tier: ' + (tier.name || tier.id)
      )

      return res.status(201).json({
        success: true,
        message: 'Success create member tier',
        data: tier
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const {
        name,
        minPoints,
        maxPoints,
        discountPercent,
        pointMultiplier,
        benefits,
        color,
        status
      } = req.body
      const modifiedBy = req.user?.id || null

      const tier = await db.member_tier.findByPk(id)

      if (!tier) {
        return res.status(404).json({
          success: false,
          message: 'Member tier not found'
        })
      }

      await tier.update({
        name: name || tier.name,
        minPoints: minPoints !== undefined ? minPoints : tier.minPoints,
        maxPoints: maxPoints !== undefined ? maxPoints : tier.maxPoints,
        discountPercent:
          discountPercent !== undefined
            ? discountPercent
            : tier.discountPercent,
        pointMultiplier:
          pointMultiplier !== undefined
            ? pointMultiplier
            : tier.pointMultiplier,
        benefits:
          benefits !== undefined
            ? memberTierController.normalizeBenefits(benefits)
            : tier.benefits,
        color: color || tier.color,
        status:
          status !== undefined
            ? status === true || status === 'true'
              ? 'active'
              : status === false || status === 'false'
                ? 'inactive'
                : String(status)
            : tier.status,
        modifiedBy
      })
      createAudit(
        req,
        'update',
        'member_tier',
        id,
        'Updated member_tier: ' + id
      )

      return res.status(200).json({
        success: true,
        message: 'Success update member tier',
        data: tier
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params

      const tier = await db.member_tier.findByPk(id)

      if (!tier) {
        return res.status(404).json({
          success: false,
          message: 'Member tier not found'
        })
      }

      await tier.destroy()
      createAudit(
        req,
        'delete',
        'member_tier',
        id,
        'Deleted member_tier: ' + id
      )

      return res.status(200).json({
        success: true,
        message: 'Success delete member tier'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getMemberTier(req, res) {
    try {
      const { points } = req.query

      if (!points) {
        return res.status(400).json({
          success: false,
          message: 'Points parameter required'
        })
      }

      const tier = await db.member_tier.findOne({
        where: {
          status: { [Op.or]: ['active', 'true'] },
          minPoints: { [Op.lte]: points },
          maxPoints: { [Op.gte]: points }
        },
        order: [['minPoints', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get tier by points',
        data: tier
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async updateMemberTier(req, res) {
    try {
      const tiers = await db.member_tier.findAll({
        where: { status: { [Op.or]: ['active', 'true'] } },
        order: [['minPoints', 'DESC']]
      })

      const members = await db.member.findAll({})

      const updates = []
      for (const member of members) {
        const newTier = tiers.find(
          (t) =>
            member.totalPoints >= t.minPoints &&
            member.totalPoints <= t.maxPoints
        )

        if (newTier && member.tier !== newTier.id) {
          await member.update({ tier: newTier.id })
          updates.push({
            memberId: member.id,
            oldTier: member.tier,
            newTier: newTier.id
          })
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Success update member tiers',
        data: {
          updated: updates.length,
          updates
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = memberTierController
