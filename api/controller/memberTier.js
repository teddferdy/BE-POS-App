const db = require('../../db/models')
const { Op } = require('sequelize')

const memberTierController = {
  async getAll(req, res) {
    try {
      const { store } = req.query

      const tiers = await db.member_tier.findAll({
        where: { store },
        order: [['minPoints', 'ASC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get member tiers',
        data: tiers
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
      const { store, name, minPoints, maxPoints, discountPercent, pointMultiplier, benefits, color } = req.body
      const createdBy = req.user?.id || null

      if (!store || !name) {
        return res.status(400).json({
          success: false,
          message: 'Store and name are required'
        })
      }

      const tier = await db.member_tier.create({
        store,
        name,
        minPoints: minPoints || 0,
        maxPoints: maxPoints || 999999,
        discountPercent: discountPercent || 0,
        pointMultiplier: pointMultiplier || 1.00,
        benefits: benefits || [],
        color: color || '#000000',
        status: true,
        createdBy
      })

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
      const { store, name, minPoints, maxPoints, discountPercent, pointMultiplier, benefits, color, status } = req.body
      const modifiedBy = req.user?.id || null

      const tier = await db.member_tier.findOne({
        where: { id, store }
      })

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
        discountPercent: discountPercent !== undefined ? discountPercent : tier.discountPercent,
        pointMultiplier: pointMultiplier !== undefined ? pointMultiplier : tier.pointMultiplier,
        benefits: benefits || tier.benefits,
        color: color || tier.color,
        status: status !== undefined ? status : tier.status,
        modifiedBy
      })

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
      const { store } = req.query

      const tier = await db.member_tier.findOne({
        where: { id, store }
      })

      if (!tier) {
        return res.status(404).json({
          success: false,
          message: 'Member tier not found'
        })
      }

      await tier.destroy()

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
      const { store, points } = req.query

      if (!points) {
        return res.status(400).json({
          success: false,
          message: 'Points parameter required'
        })
      }

      const tier = await db.member_tier.findOne({
        where: {
          store,
          status: true,
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
      const { store } = req.body

      const tiers = await db.member_tier.findAll({
        where: { store, status: true },
        order: [['minPoints', 'DESC']]
      })

      const members = await db.member.findAll({
        where: { store }
      })

      const updates = []
      for (const member of members) {
        const newTier = tiers.find(t =>
          member.totalPoints >= t.minPoints && member.totalPoints <= t.maxPoints
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