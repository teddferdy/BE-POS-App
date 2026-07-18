const db = require('../../db/models')
const { Op } = require('sequelize')
const { enrichAuditFields } = require('../../utils/auditFields')
const { emitToStore } = require('../service/socket')

const promoController = {
  async getCampaigns(req, res) {
    try {
      const { search, status, type, page = 1, limit = 10 } = req.query
      const store = req.query.store || req.user?.store

      const where = {}
      if (req.user?.roleType !== 'super_admin') {
        if (req.user?.store) {
          where.store = { [Op.contains]: [Number(req.user.store)] }
        }
      } else if (store && store !== '') {
        where.store = { [Op.contains]: [Number(store)] }
      }

      if (status && status !== 'all') {
        where.status = status
      }
      if (type && type !== 'all') {
        where.type = type
      }
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { code: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ]
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const [campaigns, total] = await Promise.all([
        db.promo_campaign.findAll({
          where,
          order: [
            ['priority', 'DESC'],
            ['createdAt', 'DESC']
          ],
          limit: parseInt(limit),
          offset,
          include: [
            {
              model: db.promo_rule,
              as: 'rules',
              where: { isActive: true },
              required: false
            },
            {
              model: db.promo_reward,
              as: 'rewards',
              where: { isActive: true },
              required: false
            }
          ]
        }),
        db.promo_campaign.count({ where })
      ])

      await enrichAuditFields(db, campaigns)

      return res.status(200).json({
        success: true,
        message: 'Success get campaigns',
        data: campaigns,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getCampaignById(req, res) {
    try {
      const { id } = req.params

      const campaign = await db.promo_campaign.findByPk(id, {
        include: [
          { model: db.promo_rule, as: 'rules' },
          { model: db.promo_reward, as: 'rewards' }
        ]
      })

      if (!campaign) {
        return res
          .status(404)
          .json({ success: false, message: 'Campaign not found' })
      }

      await enrichAuditFields(db, [campaign])

      return res.status(200).json({
        success: true,
        message: 'Success get campaign',
        data: campaign
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async createCampaign(req, res) {
    try {
      const {
        store,
        name,
        description,
        code,
        type,
        discountType,
        discountValue,
        maxDiscount,
        minPurchase,
        startDate,
        endDate,
        startTime,
        endTime,
        daysOfWeek,
        applicableTo,
        applicableIds,
        maxUsageTotal,
        maxUsagePerMember,
        priority,
        isCombinable,
        autoActivate,
        rules,
        rewards
      } = req.body

      const campaign = await db.promo_campaign.create({
        store,
        name,
        description,
        code,
        type,
        discountType: discountType || 'percentage',
        discountValue: discountValue || 0,
        maxDiscount,
        minPurchase: minPurchase || 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        startTime,
        endTime,
        daysOfWeek,
        applicableTo: applicableTo || 'all',
        applicableIds,
        maxUsageTotal,
        maxUsagePerMember,
        priority: priority || 0,
        isCombinable: isCombinable || false,
        autoActivate: autoActivate || false,
        status: autoActivate ? 'active' : 'draft',
        createdBy: req.user?.id
      })

      if (rules && rules.length > 0) {
        await db.promo_rule.bulkCreate(
          rules.map((rule) => ({
            campaignId: campaign.id,
            ruleType: rule.ruleType,
            condition: rule.condition,
            priority: rule.priority || 0,
            createdBy: req.user?.id
          }))
        )
      }

      if (rewards && rewards.length > 0) {
        await db.promo_reward.bulkCreate(
          rewards.map((reward) => ({
            campaignId: campaign.id,
            rewardType: reward.rewardType,
            rewardValue: reward.rewardValue,
            maxRewardValue: reward.maxRewardValue,
            productId: reward.productId,
            productIds: reward.productIds,
            quantity: reward.quantity || 1,
            condition: reward.condition,
            priority: reward.priority || 0,
            createdBy: req.user?.id
          }))
        )
      }

      const fullCampaign = await db.promo_campaign.findByPk(campaign.id, {
        include: [
          { model: db.promo_rule, as: 'rules' },
          { model: db.promo_reward, as: 'rewards' }
        ]
      })

      await enrichAuditFields(db, [fullCampaign])

      emitToStore(store, 'promo:created', fullCampaign)

      return res.status(201).json({
        success: true,
        message: 'Campaign created',
        data: fullCampaign
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async updateCampaign(req, res) {
    try {
      const { id } = req.params
      const updateData = req.body

      const campaign = await db.promo_campaign.findByPk(id)
      if (!campaign) {
        return res
          .status(404)
          .json({ success: false, message: 'Campaign not found' })
      }

      if (updateData.startDate)
        updateData.startDate = new Date(updateData.startDate)
      if (updateData.endDate) updateData.endDate = new Date(updateData.endDate)

      updateData.modifiedBy = req.user?.id

      await campaign.update(updateData)

      if (updateData.rules) {
        await db.promo_rule.destroy({ where: { campaignId: id } })
        if (updateData.rules.length > 0) {
          await db.promo_rule.bulkCreate(
            updateData.rules.map((rule) => ({
              campaignId: id,
              ruleType: rule.ruleType,
              condition: rule.condition,
              priority: rule.priority || 0,
              createdBy: req.user?.id
            }))
          )
        }
      }

      if (updateData.rewards) {
        await db.promo_reward.destroy({ where: { campaignId: id } })
        if (updateData.rewards.length > 0) {
          await db.promo_reward.bulkCreate(
            updateData.rewards.map((reward) => ({
              campaignId: id,
              rewardType: reward.rewardType,
              rewardValue: reward.rewardValue,
              maxRewardValue: reward.maxRewardValue,
              productId: reward.productId,
              productIds: reward.productIds,
              quantity: reward.quantity || 1,
              condition: reward.condition,
              priority: reward.priority || 0,
              createdBy: req.user?.id
            }))
          )
        }
      }

      const fullCampaign = await db.promo_campaign.findByPk(id, {
        include: [
          { model: db.promo_rule, as: 'rules' },
          { model: db.promo_reward, as: 'rewards' }
        ]
      })

      await enrichAuditFields(db, [fullCampaign])

      emitToStore(campaign.store, 'promo:updated', fullCampaign)

      return res.status(200).json({
        success: true,
        message: 'Campaign updated',
        data: fullCampaign
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async updateCampaignStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body

      const campaign = await db.promo_campaign.findByPk(id)
      if (!campaign) {
        return res
          .status(404)
          .json({ success: false, message: 'Campaign not found' })
      }

      await campaign.update({
        status,
        modifiedBy: req.user?.id
      })

      emitToStore(campaign.store, 'promo:statusChanged', { id, status })

      return res.status(200).json({
        success: true,
        message: `Campaign status updated to ${status}`,
        data: campaign
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async deleteCampaign(req, res) {
    try {
      const { id } = req.params

      const campaign = await db.promo_campaign.findByPk(id)
      if (!campaign) {
        return res
          .status(404)
          .json({ success: false, message: 'Campaign not found' })
      }

      await campaign.update({ status: 'cancelled', modifiedBy: req.user?.id })
      await campaign.destroy()

      emitToStore(campaign.store, 'promo:deleted', { id })

      return res.status(200).json({
        success: true,
        message: 'Campaign deleted'
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async applyPromo(req, res) {
    try {
      const { store, orderId, memberId, code, cartItems, subtotal } = req.body

      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      const currentDay = now.getDay()

      const where = {
        status: 'active',
        startDate: { [Op.lte]: now },
        endDate: { [Op.gte]: now }
      }

      if (req.user?.roleType !== 'super_admin') {
        if (req.user?.store) {
          where.store = { [Op.contains]: [Number(req.user.store)] }
        }
      } else if (store) {
        where.store = { [Op.contains]: [Number(store)] }
      }

      if (code) {
        where.code = code
      }

      const campaigns = await db.promo_campaign.findAll({
        where,
        include: [
          { model: db.promo_rule, as: 'rules', where: { isActive: true } },
          { model: db.promo_reward, as: 'rewards', where: { isActive: true } }
        ],
        order: [['priority', 'DESC']]
      })

      const applicablePromos = []

      for (const campaign of campaigns) {
        if (
          campaign.maxUsageTotal &&
          campaign.currentUsage >= campaign.maxUsageTotal
        ) {
          continue
        }

        if (campaign.daysOfWeek && !campaign.daysOfWeek.includes(currentDay)) {
          continue
        }

        if (campaign.startTime && campaign.endTime) {
          if (
            currentTime < campaign.startTime ||
            currentTime > campaign.endTime
          ) {
            continue
          }
        }

        let isEligible = true

        if (campaign.type === 'birthday' && memberId) {
          const member = await db.member.findByPk(memberId)
          if (member) {
            const today = new Date()
            const memberDob = new Date(member.dateOfBirth)
            if (
              today.getMonth() !== memberDob.getMonth() ||
              today.getDate() !== memberDob.getDate()
            ) {
              isEligible = false
            }
          } else {
            isEligible = false
          }
        }

        if (campaign.type === 'buy_x_get_y' && cartItems) {
          const rule = campaign.rules.find((r) => r.ruleType === 'buy_x_get_y')
          if (rule) {
            const { buyProductId, buyQuantity } = rule.condition
            const cartItem = cartItems.find(
              (item) => item.productId === buyProductId
            )
            if (!cartItem || cartItem.quantity < buyQuantity) {
              isEligible = false
            }
          }
        }

        if (campaign.type === 'spend_get' && subtotal) {
          if (subtotal < campaign.minPurchase) {
            isEligible = false
          }
        }

        if (isEligible) {
          const reward = campaign.rewards[0]
          let discountAmount = 0

          if (reward) {
            if (reward.rewardType === 'discount_percentage') {
              discountAmount = Math.round(
                (subtotal || 0) * (reward.rewardValue / 100)
              )
              if (
                reward.maxRewardValue &&
                discountAmount > reward.maxRewardValue
              ) {
                discountAmount = reward.maxRewardValue
              }
            } else if (reward.rewardType === 'discount_fixed') {
              discountAmount = reward.rewardValue
            }
          }

          applicablePromos.push({
            campaignId: campaign.id,
            name: campaign.name,
            code: campaign.code,
            type: campaign.type,
            discountAmount,
            reward: reward
              ? {
                  type: reward.rewardType,
                  value: reward.rewardValue,
                  productId: reward.productId,
                  quantity: reward.quantity
                }
              : null
          })
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Promos evaluated',
        data: {
          applicablePromos,
          bestPromo: applicablePromos[0] || null
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async recordPromoUsage(req, res) {
    try {
      const {
        campaignId,
        orderId,
        memberId,
        discountApplied,
        freeItemsGiven,
        pointsMultiplier,
        cashbackAmount
      } = req.body

      const campaign = await db.promo_campaign.findByPk(campaignId)
      if (!campaign) {
        return res
          .status(404)
          .json({ success: false, message: 'Campaign not found' })
      }

      if (
        campaign.maxUsageTotal &&
        campaign.currentUsage >= campaign.maxUsageTotal
      ) {
        return res
          .status(400)
          .json({ success: false, message: 'Campaign usage limit reached' })
      }

      if (campaign.maxUsagePerMember && memberId) {
        const memberUsage = await db.promo_usage.count({
          where: { campaignId, memberId }
        })
        if (memberUsage >= campaign.maxUsagePerMember) {
          return res
            .status(400)
            .json({ success: false, message: 'Member usage limit reached' })
        }
      }

      const usage = await db.promo_usage.create({
        store: campaign.store,
        campaignId,
        orderId,
        memberId,
        discountApplied: discountApplied || 0,
        freeItemsGiven,
        pointsMultiplier: pointsMultiplier || 1,
        cashbackAmount: cashbackAmount || 0,
        appliedAt: new Date(),
        createdBy: req.user?.id
      })

      await campaign.update({
        currentUsage: campaign.currentUsage + 1
      })

      await enrichAuditFields(db, [usage])

      emitToStore(campaign.store, 'promo:used', usage)

      return res.status(201).json({
        success: true,
        message: 'Promo usage recorded',
        data: usage
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getCampaignStats(req, res) {
    try {
      const store = req.query.store || req.user?.store

      const where = {}
      if (req.user?.roleType !== 'super_admin') {
        if (req.user?.store) {
          where.store = { [Op.contains]: [Number(req.user.store)] }
        }
      } else if (store && store !== '') {
        where.store = { [Op.contains]: [Number(store)] }
      }

      const [totalCampaigns, activeCampaigns, totalUsage, totalDiscountGiven] =
        await Promise.all([
          db.promo_campaign.count({ where }),
          db.promo_campaign.count({ where: { ...where, status: 'active' } }),
          db.promo_usage.count({ where: { store: where.store } }),
          db.promo_usage.sum('discountApplied', {
            where: { store: where.store }
          })
        ])

      return res.status(200).json({
        success: true,
        message: 'Success get campaign stats',
        data: {
          totalCampaigns,
          activeCampaigns,
          totalUsage,
          totalDiscountGiven: totalDiscountGiven || 0
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async autoActivateCampaigns(req, res) {
    try {
      const now = new Date()

      const campaignsToActivate = await db.promo_campaign.findAll({
        where: {
          autoActivate: true,
          status: 'draft',
          startDate: { [Op.lte]: now },
          endDate: { [Op.gte]: now }
        }
      })

      let activatedCount = 0
      for (const campaign of campaignsToActivate) {
        await campaign.update({ status: 'active', modifiedBy: req.user?.id })
        emitToStore(campaign.store, 'promo:activated', campaign)
        activatedCount++
      }

      const campaignsToExpire = await db.promo_campaign.findAll({
        where: {
          status: 'active',
          endDate: { [Op.lt]: now }
        }
      })

      let expiredCount = 0
      for (const campaign of campaignsToExpire) {
        await campaign.update({ status: 'expired', modifiedBy: req.user?.id })
        emitToStore(campaign.store, 'promo:expired', campaign)
        expiredCount++
      }

      return res.status(200).json({
        success: true,
        message: 'Auto-activation completed',
        data: {
          activated: activatedCount,
          expired: expiredCount
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = promoController
