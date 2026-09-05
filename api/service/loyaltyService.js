'use strict'
const db = require('../../db/models')
const { Op } = require('sequelize')

// Single authoritative path for mutating a member's point balance, mirroring
// stockMutationService.adjustProductStock exactly: lock the row first,
// apply the change as an atomic SQL delta (not a JS-computed
// read-then-write), so two concurrent redemptions/earns for the same
// member — two terminals redeeming the same member's points at once, or a
// redeem racing an earn — can never lose an update.
//
// Callers MUST already be inside a transaction and pass it in.

/**
 * @param {object} params
 * @param {number} params.memberId
 * @param {number} params.deltaPoints - signed; negative for redemption
 * @param {number} [params.deltaLifetimePoints=0] - only ever positive in
 *   practice (lifetime total never decreases on redemption)
 * @param {number|null} [params.referenceId] - member_point_history.transactionId
 * @param {string|null} [params.notes]
 * @param {number|null} [params.createdBy]
 * @param {import('sequelize').Transaction} params.transaction - required
 * @param {boolean} [params.floorAtZero=true]
 * @returns {Promise<{member:object, pointsBefore:number, pointsAfter:number}|null>}
 *   null if delta is a no-op or the member doesn't exist.
 */
async function adjustMemberPoints({
  memberId,
  deltaPoints,
  deltaLifetimePoints = 0,
  referenceId = null,
  notes = null,
  createdBy = null,
  transaction,
  floorAtZero = true
}) {
  if (!transaction) {
    throw new Error('adjustMemberPoints requires an explicit transaction')
  }
  const delta = Math.trunc(Number(deltaPoints)) || 0
  const lifetimeDelta = Math.trunc(Number(deltaLifetimePoints)) || 0
  if (delta === 0 && lifetimeDelta === 0) return null

  const member = await db.member.findByPk(memberId, {
    transaction,
    lock: transaction.LOCK.UPDATE
  })
  if (!member) return null

  const pointsBefore = Number(member.totalPoints) || 0
  const literal = floorAtZero
    ? `GREATEST("totalPoints" + (${delta}), 0)`
    : `"totalPoints" + (${delta})`
  const pointsAfter = floorAtZero
    ? Math.max(pointsBefore + delta, 0)
    : pointsBefore + delta

  const updateData = { totalPoints: db.sequelize.literal(literal) }
  if (lifetimeDelta !== 0) {
    updateData.lifetimePoints = db.sequelize.literal(
      `"lifetimePoints" + (${lifetimeDelta})`
    )
  }
  await member.update(updateData, { transaction })
  member.totalPoints = pointsAfter

  await db.member_point_history.create(
    {
      member: memberId,
      pointsChange: delta,
      pointsBefore,
      pointsAfter,
      transactionId: referenceId,
      notes,
      createdBy
    },
    { transaction }
  )

  return { member, pointsBefore, pointsAfter }
}

// Re-evaluates and (if warranted) applies a tier upgrade for an
// already-locked member instance, inside the same transaction as the point
// adjustment that triggered it. Never downgrades — matches the original
// inline logic in order.js exactly (only moves up if the new tier's
// minPoints exceeds the current tier's).
async function maybeUpgradeMemberTier({ member, transaction }) {
  const newTotal = Number(member.totalPoints) || 0
  let targetTier = await db.member_tier.findOne({
    where: {
      status: 'active',
      minPoints: { [Op.lte]: newTotal },
      maxPoints: { [Op.gte]: newTotal }
    },
    order: [['minPoints', 'DESC']],
    transaction
  })
  if (!targetTier) {
    targetTier = await db.member_tier.findOne({
      where: { status: 'active', minPoints: { [Op.lte]: newTotal } },
      order: [['minPoints', 'DESC']],
      transaction
    })
  }
  if (!targetTier) return
  const currentTierRow = member.tier
    ? await db.member_tier.findByPk(member.tier, { transaction })
    : null
  const currentMin = Number(currentTierRow?.minPoints ?? -1)
  if (Number(targetTier.minPoints) > currentMin) {
    await member.update({ tier: targetTier.id }, { transaction })
  }
}

module.exports = { adjustMemberPoints, maybeUpgradeMemberTier }
