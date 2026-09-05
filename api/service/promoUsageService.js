'use strict'
const db = require('../../db/models')

// Locks the campaign row, re-validates maxUsageTotal under that lock, and
// atomically increments currentUsage — closing the check-then-act race
// where two concurrent orders both read currentUsage below the limit and
// both incremented, letting a capped campaign be redeemed more times than
// intended (the unlocked `campaign.update({currentUsage: currentUsage+1})`
// this replaces could silently lose one side of that race).
//
// Callers MUST already be inside a transaction and pass it in.
//
// Returns:
//   { campaign, usage }        - recorded normally
//   { notFound: true }         - campaignId doesn't exist
//   { limitReached: true, campaign }       - maxUsageTotal already hit
//   { memberLimitReached: true, campaign } - maxUsagePerMember already hit
// Callers decide what a limit hit means for them: promo.js's standalone
// endpoint rejects the request outright (this mirrors what it already did,
// just now race-safe); order.js's checkout-embedded promo application
// treats it as "don't record usage" without failing the order, since the
// order's totals were already computed before this point and the whole
// point of putting stock/payment ahead of this in transaction ordering is
// that a promo-counter edge case must never roll back an otherwise-valid
// paid order.
async function incrementPromoUsage({
  campaignId,
  orderId = null,
  memberId = null,
  discountApplied = 0,
  freeItemsGiven = null,
  pointsMultiplier = 1,
  cashbackAmount = 0,
  createdBy = null,
  transaction,
  enforcePerMemberLimit = true
}) {
  if (!transaction) {
    throw new Error('incrementPromoUsage requires an explicit transaction')
  }
  const campaign = await db.promo_campaign.findByPk(campaignId, {
    transaction,
    lock: transaction.LOCK.UPDATE
  })
  if (!campaign) return { notFound: true }

  const currentUsage = Number(campaign.currentUsage) || 0
  if (
    campaign.maxUsageTotal &&
    currentUsage >= Number(campaign.maxUsageTotal)
  ) {
    return { limitReached: true, campaign }
  }

  if (enforcePerMemberLimit && campaign.maxUsagePerMember && memberId) {
    const memberUsage = await db.promo_usage.count({
      where: { campaignId, memberId },
      transaction
    })
    if (memberUsage >= Number(campaign.maxUsagePerMember)) {
      return { memberLimitReached: true, campaign }
    }
  }

  const usage = await db.promo_usage.create(
    {
      store: campaign.store,
      campaignId,
      orderId,
      memberId,
      discountApplied: discountApplied || 0,
      freeItemsGiven,
      pointsMultiplier: pointsMultiplier || 1,
      cashbackAmount: cashbackAmount || 0,
      appliedAt: new Date(),
      createdBy
    },
    { transaction }
  )

  await campaign.update(
    { currentUsage: db.sequelize.literal('"currentUsage" + 1') },
    { transaction }
  )
  campaign.currentUsage = currentUsage + 1

  return { campaign, usage }
}

module.exports = { incrementPromoUsage }
