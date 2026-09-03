const db = require('../../db/models')
const Order = db.order
const OrderItem = db.order_item
const OrderStatus = db.order_status
const Table = db.table
const Product = db.product
const Discount = db.discount
const { Op } = require('sequelize')
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')
const { emitItemStatusUpdate, emitNewOrder } = require('../service/socket')
const batchService = require('../service/batchService')

// ponytail: validFrom/validUntil opsional — null berarti selalu berlaku
const isBundleWithinValidityPeriod = (bundle, now = new Date()) => {
  const validFrom = bundle.validFrom ? new Date(bundle.validFrom) : null
  const validUntil = bundle.validUntil ? new Date(bundle.validUntil) : null
  if (validFrom && isNaN(validFrom.getTime())) return true
  if (validUntil && isNaN(validUntil.getTime())) return true
  if (validFrom && validFrom > now) return false
  if (validUntil && validUntil < now) return false
  return true
}

let _productStoreExists = null
let _categoryStoreExists = null
let _orderPromoCampaignCol = null
let _orderSessionCol = null
const hasTable = async (tableName) => {
  if (tableName === 'product_store') {
    if (_productStoreExists !== null) return _productStoreExists
  } else if (tableName === 'category_store') {
    if (_categoryStoreExists !== null) return _categoryStoreExists
  }
  try {
    await db.sequelize.query(`SELECT 1 FROM ${tableName} LIMIT 1`)
    if (tableName === 'product_store') _productStoreExists = true
    if (tableName === 'category_store') _categoryStoreExists = true
    return true
  } catch {
    if (tableName === 'product_store') _productStoreExists = false
    if (tableName === 'category_store') _categoryStoreExists = false
    return false
  }
}

const hasOrderColumn = async (colName) => {
  if (colName === 'promoCampaignId') {
    if (_orderPromoCampaignCol !== null) return _orderPromoCampaignCol
    try {
      const [results] = await db.sequelize.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'order' AND column_name = '${colName}' LIMIT 1`
      )
      _orderPromoCampaignCol = results.length > 0
      return _orderPromoCampaignCol
    } catch {
      _orderPromoCampaignCol = false
      return false
    }
  }
  if (colName === 'session') {
    if (_orderSessionCol !== null) return _orderSessionCol
    try {
      const [results] = await db.sequelize.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'order' AND column_name = 'session' LIMIT 1`
      )
      _orderSessionCol = results.length > 0
      return _orderSessionCol
    } catch {
      _orderSessionCol = false
      return false
    }
  }
  return true
}

const getOrderAttributes = async () => {
  const exclude = []
  if (!(await hasOrderColumn('promoCampaignId'))) {
    exclude.push('promoCampaignId')
  }
  if (!(await hasOrderColumn('session'))) {
    exclude.push('session')
  }
  if (exclude.length === 0) return undefined
  return { exclude }
}

const generateOrderNumber = () => {
  const date = new Date()
  const timestamp = date.getTime().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD${timestamp}${random}`
}

// Resolve effective stock for a product in a store. Uses the store-specific
// stock row (product_store_stock) when present, otherwise falls back to the
// base product stock. This matches how the cashier UI displays stock and how
// stock is deducted on sale (both base and per-store are kept in sync).
const getEffectiveStock = async (product, store) => {
  if (!product || !store) return null
  const base =
    product.stock !== null && product.stock !== undefined
      ? Number(product.stock)
      : null
  try {
    const pss = await db.product_store_stock.findOne({
      where: { product: product.id, store }
    })
    if (pss && pss.stock !== null && pss.stock !== undefined) {
      return Number(pss.stock)
    }
  } catch {
    // product_store_stock table may not exist; fall back to base stock
  }
  return base
}

// Compute the server-side unit price for an item, including the base product
// price plus any selected option/modifier markup. The FE only sends the chosen
// option/modifier names; prices are always re-derived from the product's stored
// data so the server never trusts client-sent amounts.
const getServerItemPrice = (prod, item) => {
  const base = Number(prod.price) || 0
  let extra = 0

  const optNames = (item.options || []).map((o) => o && o.name).filter(Boolean)
  if (optNames.length) {
    if (Array.isArray(prod.options)) {
      for (const group of prod.options) {
        const groupName = (group && group.name) || ''
        for (const opt of (group && group.options) || []) {
          if (!opt || !opt.name) continue
          if (
            optNames.includes(opt.name) ||
            optNames.includes(`${groupName} - ${opt.name}`)
          ) {
            extra += Number(opt.price) || 0
          }
        }
      }
    }
    // Legacy flat variant list (if exposed by the data source)
    if (Array.isArray(prod.variant)) {
      for (const v of prod.variant) {
        const vName = v && (v.nameVariant || v.name)
        if (vName && optNames.includes(vName)) {
          extra += Number(v.price) || 0
        }
      }
    }
  }

  const modNames = (item.modifiers || [])
    .map((m) => m && m.name)
    .filter(Boolean)
  if (modNames.length && Array.isArray(prod.modifiers)) {
    for (const m of prod.modifiers) {
      if (m && m.name && modNames.includes(m.name)) {
        extra += Number(m.price) || 0
      }
    }
  }

  return base + extra
}

// ponytail: sequential daily pickup/customer number per store (1, 2, 3...).
// Atomic upsert against order_daily_counter instead of MAX(customerNumber)+1
// — the old query had no lock and no unique constraint, so two concurrent
// orders at the same store on the same day could read the same MAX and both
// receive the same pickup number. INSERT..ON CONFLICT DO UPDATE is a single
// statement Postgres serializes per (store, date) row, so concurrent callers
// are queued, not raced. Pass the same transaction used to create the order
// so a rolled-back order (e.g. insufficient stock) doesn't burn a number.
const generateCustomerNumber = async (store, t) => {
  const counterDate = new Date().toISOString().slice(0, 10)
  const rows = await db.sequelize.query(
    `INSERT INTO order_daily_counter (store, "counterDate", "lastValue", "updatedAt")
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (store, "counterDate")
     DO UPDATE SET "lastValue" = order_daily_counter."lastValue" + 1, "updatedAt" = NOW()
     RETURNING "lastValue"`,
    {
      bind: [store, counterDate],
      transaction: t,
      type: db.sequelize.QueryTypes.SELECT
    }
  )
  return rows[0]?.lastValue || 1
}

const getActiveTaxRate = async (store) => {
  try {
    const taxConfigs = await db.taxConfig.findAll({
      where: { store, type: 'ppn', status: 'active' },
      attributes: ['rate']
    })
    if (taxConfigs.length > 0) {
      return taxConfigs.reduce((sum, t) => sum + Number(t.rate), 0)
    }
  } catch (e) {
    console.error('Error fetching tax config:', e.message)
  }
  return 11 // fallback default
}

const getServiceChargeRate = async (store) => {
  try {
    const configs = await db.taxConfig.findAll({
      where: { store, type: 'service_charge', status: 'active' },
      attributes: ['rate']
    })
    if (configs.length > 0) {
      return configs.reduce((sum, t) => sum + Number(t.rate), 0)
    }
  } catch (e) {
    console.error('Error fetching service charge config:', e.message)
  }
  return 0
}

const evaluatePromoCampaign = async (items, store, customerId, subtotal) => {
  const now = new Date()
  const currentDay = now.getDay()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  const campaigns = await db.promo_campaign.findAll({
    where: {
      status: 'active',
      startDate: { [Op.lte]: now },
      endDate: { [Op.gte]: now }
    },
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
    ],
    order: [['priority', 'DESC']]
  })

  let bestDiscount = 0
  let bestCampaignId = null
  let bestReward = null

  for (const campaign of campaigns) {
    if (store && campaign.store) {
      const storeArr = Array.isArray(campaign.store)
        ? campaign.store
        : [campaign.store]
      if (!storeArr.includes(Number(store))) continue
    }

    if (
      campaign.maxUsageTotal &&
      campaign.currentUsage >= campaign.maxUsageTotal
    )
      continue

    if (
      campaign.daysOfWeek &&
      campaign.daysOfWeek.length > 0 &&
      !campaign.daysOfWeek.includes(currentDay)
    )
      continue

    if (campaign.startTime && campaign.endTime) {
      if (currentTime < campaign.startTime || currentTime > campaign.endTime)
        continue
    }

    if (campaign.minPurchase && subtotal < campaign.minPurchase) continue

    if (campaign.maxUsagePerMember && customerId) {
      const memberUsage = await db.promo_usage.count({
        where: { campaignId: campaign.id, memberId: customerId }
      })
      if (memberUsage >= campaign.maxUsagePerMember) continue
    }

    let isEligible = true

    for (const rule of campaign.rules || []) {
      if (!rule.isActive) continue

      switch (rule.ruleType) {
        case 'buy_x_get_y': {
          const { buyProductId, buyQuantity } = rule.condition || {}
          const cartItem = items.find(
            (item) => (item.product || item.productId) === buyProductId
          )
          if (!cartItem || cartItem.quantity < buyQuantity) {
            isEligible = false
          }
          break
        }
        case 'spend_threshold': {
          if (subtotal < ((rule.condition && rule.condition.minSpend) || 0)) {
            isEligible = false
          }
          break
        }
        case 'member_tier': {
          if (customerId) {
            const member = await db.member.findByPk(customerId)
            if (
              !member ||
              member.tier !== (rule.condition && rule.condition.tierId)
            ) {
              isEligible = false
            }
          } else {
            isEligible = false
          }
          break
        }
        case 'birthday': {
          if (customerId) {
            const member = await db.member.findByPk(customerId)
            if (member) {
              const dob = new Date(member.dateOfBirth)
              if (
                now.getMonth() !== dob.getMonth() ||
                now.getDate() !== dob.getDate()
              ) {
                isEligible = false
              }
            } else {
              isEligible = false
            }
          } else {
            isEligible = false
          }
          break
        }
        case 'first_purchase': {
          if (customerId) {
            const orderCount = await Order.count({
              where: { customerId, status: { [Op.ne]: 'void' } }
            })
            if (orderCount > 0) {
              isEligible = false
            }
          } else {
            isEligible = false
          }
          break
        }
        case 'time': {
          if (campaign.startTime && campaign.endTime) {
            if (
              currentTime < campaign.startTime ||
              currentTime > campaign.endTime
            ) {
              isEligible = false
            }
          }
          break
        }
      }
      if (!isEligible) break
    }

    if (!isEligible) continue

    const reward = (campaign.rewards && campaign.rewards[0]) || null
    if (!reward) continue

    let discountAmount = 0

    switch (reward.rewardType) {
      case 'discount_percentage': {
        discountAmount = Math.round(subtotal * (reward.rewardValue / 100))
        if (reward.maxRewardValue && discountAmount > reward.maxRewardValue) {
          discountAmount = reward.maxRewardValue
        }
        break
      }
      case 'discount_fixed': {
        discountAmount = reward.rewardValue
        break
      }
      case 'buy_x_get_y': {
        const freeProductId = reward.productId
        const freeQty = reward.quantity || 1
        const targetItem = items.find(
          (item) => (item.product || item.productId) === freeProductId
        )
        if (targetItem) {
          discountAmount =
            (targetItem.unitPrice || targetItem.price || 0) * freeQty
        }
        break
      }
      case 'free_item': {
        const freeProductId = reward.productId
        const freeQty = reward.quantity || 1
        const freeProduct = freeProductId
          ? await Product.findByPk(freeProductId)
          : null
        if (freeProduct) {
          discountAmount = (freeProduct.price || 0) * freeQty
        }
        break
      }
    }

    if (discountAmount > bestDiscount) {
      bestDiscount = discountAmount
      bestCampaignId = campaign.id
      bestReward = reward
    }
  }

  return {
    discountAmount: bestDiscount,
    campaignId: bestCampaignId,
    reward: bestReward
  }
}

const calculateOrderTotals = (
  items,
  discountValue = 0,
  discountType = 'none',
  taxRate = 0,
  serviceChargeRate = 0
) => {
  let subTotal = 0
  let totalQuantity = 0

  items.forEach((item) => {
    subTotal += item.subtotal
    totalQuantity += item.quantity
  })

  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = Math.round(subTotal * (discountValue / 100))
  } else if (discountType === 'nominal') {
    discountAmount = discountValue
  }

  const afterDiscount = subTotal - discountAmount
  const taxAmount = Math.round(afterDiscount * (taxRate / 100))
  const serviceChargeAmount = Math.round(
    afterDiscount * (serviceChargeRate / 100)
  )
  const totalPrice = afterDiscount + taxAmount + serviceChargeAmount

  return {
    subTotal,
    totalQuantity,
    discountAmount,
    taxAmount,
    serviceChargeAmount,
    totalPrice
  }
}

// ---- createOrder helpers ---------------------------------------------
// Split out of what used to be one ~780-line function so each concern
// (table check, discount resolution, item pricing/validation, totals) can
// be read and changed independently. All still module-private — only
// exports.createOrder below calls them.

const checkTableAvailable = async (tableId, store) => {
  if (!tableId) return { ok: true }
  const table = await Table.findOne({ where: { id: tableId, store } })
  if (table && ['occupied', 'reserved', 'maintenance'].includes(table.status)) {
    return {
      ok: false,
      message:
        table.status === 'occupied'
          ? 'Table is already occupied'
          : 'Table is not available'
    }
  }
  return { ok: true }
}

// Resolves which discount applies before promo campaigns are evaluated, in
// priority order: explicit discountId > promo code > member tier auto-discount
// > point redemption (on top, applied later in calculateFinalTotals).
const resolveOrderDiscount = async ({
  discountId,
  promoCode,
  customerId,
  redeemedPoints,
  store
}) => {
  let discountValue = 0
  let discountType = 'none'
  let appliedDiscountId = null
  let appliedDiscountMeta = null

  if (discountId) {
    const discount = await Discount.findOne({ where: { id: discountId, store } })
    if (discount) {
      discountValue = discount.value
      discountType = discount.type
      appliedDiscountId = discount.id
      appliedDiscountMeta = discount
    }
  }

  if (promoCode && !appliedDiscountId) {
    const promoDiscount = await Discount.findOne({
      where: { code: promoCode.trim().toUpperCase(), store, status: 'active' }
    })
    if (promoDiscount) {
      const now = new Date()
      const startsOk =
        !promoDiscount.startDate || new Date(promoDiscount.startDate) <= now
      const endsOk =
        !promoDiscount.endDate || new Date(promoDiscount.endDate) >= now
      if (startsOk && endsOk) {
        discountValue = promoDiscount.value
        discountType = promoDiscount.type
        appliedDiscountId = promoDiscount.id
        appliedDiscountMeta = promoDiscount
      }
    }
  }

  if (!appliedDiscountId && customerId) {
    try {
      const member = await db.member.findByPk(customerId)
      if (member && member.tier) {
        const tier = await db.member_tier.findByPk(member.tier)
        if (tier && tier.discountPercent > 0) {
          discountValue = tier.discountPercent
          discountType = 'percent'
        }
      }
    } catch (e) {
      console.error('Tier discount lookup error:', e.message)
    }
  }

  const POINT_VALUE = 1
  let redeemedPointsUsed = 0
  let pointDiscountAmount = 0
  if (redeemedPoints > 0 && customerId) {
    try {
      const member = await db.member.findByPk(customerId)
      if (member && (member.totalPoints || 0) >= redeemedPoints) {
        pointDiscountAmount = redeemedPoints * POINT_VALUE
        redeemedPointsUsed = redeemedPoints
      }
    } catch (e) {
      console.error('Point redemption error:', e.message)
    }
  }

  return {
    discountValue,
    discountType,
    appliedDiscountId,
    appliedDiscountMeta,
    redeemedPointsUsed,
    pointDiscountAmount
  }
}

// Re-derives every item's price from the DB (never trusts client-sent
// amounts), loads + validates any referenced bundles, and checks stock for
// every line — bundle components and regular items alike, in one pass
// instead of three separate passes over the same items. Mutates `items` in
// place (basePrice/price/unitPrice/subtotal/_origSubtotal) and returns the
// bundleMap plus a Map of already-fetched regular-item products so the
// caller doesn't have to re-fetch them again for order-item creation.
const loadAndPriceOrderItems = async (items, store) => {
  items.forEach((item) => {
    item._origSubtotal = item.subtotal
  })

  const bundleMap = {}
  const productById = new Map()

  for (const item of items) {
    if (item.bundleId) {
      const bundle = await db.product_bundle.findByPk(item.bundleId, {
        include: [
          {
            model: db.product_bundle_item,
            as: 'items',
            include: [{ model: Product, as: 'productData' }]
          }
        ]
      })
      if (!bundle) {
        return {
          ok: false,
          message: `Bundle not found: ${item.bundleName || item.bundleId}`
        }
      }
      if (
        !bundle.isAvailable ||
        bundle.status !== 'active' ||
        !isBundleWithinValidityPeriod(bundle)
      ) {
        return { ok: false, message: `Bundle "${bundle.name}" is not available` }
      }
      bundleMap[item.bundleId] = bundle

      const bundlePrice = Number(bundle.bundlePrice) || 0
      item.price = bundlePrice
      item.basePrice = bundlePrice
      item.unitPrice = bundlePrice
      item.subtotal = bundlePrice * Number(item.quantity)

      const bundleQty = Number(item.quantity) || 1
      for (const bi of bundle.items) {
        const prod = bi.productData
        if (!prod) {
          return {
            ok: false,
            message: `Product in bundle "${bundle.name}" not found`
          }
        }
        const needed = bi.quantity * bundleQty
        const avail = await getEffectiveStock(prod, store)
        if (avail !== null && avail < needed) {
          return {
            ok: false,
            message: `Stok "${prod.nameProduct}" tidak mencukupi untuk bundle "${bundle.name}". Tersedia: ${avail}, dibutuhkan: ${needed}`
          }
        }
      }
      continue
    }

    // Regular item — fetched once here and reused for stock check and (via
    // the returned productById map) order-item creation, instead of the
    // same row being fetched three separate times across the request.
    const prod = await Product.findByPk(item.product || item.productId)
    if (!prod) {
      return {
        ok: false,
        message: `Product not found: ${item.productName || item.product || item.productId}`
      }
    }
    productById.set(prod.id, prod)

    const serverPrice = getServerItemPrice(prod, item)
    item.basePrice = Number(prod.price) || 0
    item.price = serverPrice
    item.unitPrice = serverPrice
    item.subtotal = serverPrice * Number(item.quantity)

    const avail = await getEffectiveStock(prod, store)
    if (avail !== null && avail < Number(item.quantity)) {
      return {
        ok: false,
        message: `Stok "${prod.nameProduct}" tidak mencukupi. Tersedia: ${avail}, diminta: ${item.quantity}`
      }
    }
  }

  return { ok: true, bundleMap, productById }
}

// Evaluates promo campaigns against the priced items, applies whichever of
// (explicit/promo/tier discount) vs (promo campaign) is in effect, then
// layers the maximumDiscount cap and point-redemption discount on top.
const calculateFinalTotals = async ({
  items,
  store,
  customerId,
  discountValue,
  discountType,
  appliedDiscountId,
  appliedDiscountMeta,
  pointDiscountAmount,
  taxRate,
  serviceChargeRate
}) => {
  let rawSubTotal = 0
  items.forEach((item) => {
    rawSubTotal += item.subtotal
  })

  const campaignWithSubtotal = await evaluatePromoCampaign(
    items.map((item) => ({
      ...item,
      productId: item.product || item.productId,
      unitPrice: item.unitPrice ?? item.price ?? item.basePrice ?? 0
    })),
    store,
    customerId,
    rawSubTotal
  )

  let totals
  let promoDiscountAmount = 0
  let appliedCampaignId = null

  // Use campaign discount if no manual discount applied and campaign gives a better deal
  if (!appliedDiscountId && campaignWithSubtotal.discountAmount > 0) {
    promoDiscountAmount = campaignWithSubtotal.discountAmount
    appliedCampaignId = campaignWithSubtotal.campaignId
    totals = calculateOrderTotals(items, 0, 'none', taxRate, serviceChargeRate)
    totals.discountAmount = promoDiscountAmount
  } else if (
    appliedDiscountMeta &&
    appliedDiscountMeta.conditions &&
    appliedDiscountMeta.conditions.promoType
  ) {
    // Legacy: still support old discount.conditions for backward compat, but log deprecation
    console.warn(
      'DEPRECATED: discount.conditions.promoType detected. Migrate to promo_campaign.'
    )
    totals = calculateOrderTotals(items, 0, 'none', taxRate, serviceChargeRate)
  } else {
    totals = calculateOrderTotals(
      items,
      discountValue,
      discountType,
      taxRate,
      serviceChargeRate
    )
  }

  // Apply maximumDiscount cap for percent type
  if (discountType === 'percent' && appliedDiscountId) {
    const discountMeta = await Discount.findByPk(appliedDiscountId)
    if (
      discountMeta &&
      discountMeta.maximumDiscount > 0 &&
      totals.discountAmount > discountMeta.maximumDiscount
    ) {
      totals.discountAmount = discountMeta.maximumDiscount
      const afterDiscount = totals.subTotal - totals.discountAmount
      totals.taxAmount = Math.round(afterDiscount * (taxRate / 100))
      totals.serviceChargeAmount = Math.round(
        afterDiscount * (serviceChargeRate / 100)
      )
      totals.totalPrice =
        afterDiscount + totals.taxAmount + totals.serviceChargeAmount
    }
  }

  // Apply point redemption discount on top
  if (pointDiscountAmount > 0) {
    totals.discountAmount += pointDiscountAmount
    const afterDiscount = totals.subTotal - totals.discountAmount
    totals.taxAmount = Math.round(afterDiscount * (taxRate / 100))
    totals.serviceChargeAmount = Math.round(
      afterDiscount * (serviceChargeRate / 100)
    )
    totals.totalPrice = Math.max(
      0,
      afterDiscount + totals.taxAmount + totals.serviceChargeAmount
    )
  }

  return { totals, promoDiscountAmount, appliedCampaignId, campaignWithSubtotal }
}

// Fetches the full order shape (items + transactions) used both for a
// fresh 201 and for an idempotent replay, so the two response bodies match.
const fetchFullOrder = async (orderId) =>
  Order.findOne({
    where: { id: orderId },
    include: [
      { model: OrderItem, as: 'items' },
      { model: db.transaction, as: 'transactions' }
    ]
  })

exports.createOrder = async (req, res) => {
  const {
    store,
    tableId,
    cashierId,
    cashierName,
    items,
    discountId,
    promoCode,
    customerId,
    customerName,
    customerPhone,
    notes,
    source,
    paymentMethod,
    currencyId,
    currencyCode,
    exchangeRate,
    redeemedPoints,
    idempotencyKey
  } = req.body

  try {
    // A retried/duplicate submit with the same key (e.g. a POS terminal
    // retrying after a network timeout, or a double-tap on "Pay") returns
    // the order already created instead of creating a second one. This is
    // a fast-path check only — the real guarantee is the unique index on
    // (store, idempotencyKey), enforced below if two such requests race.
    if (idempotencyKey) {
      const existing = await Order.findOne({ where: { store, idempotencyKey } })
      if (existing) {
        const fullOrder = await fetchFullOrder(existing.id)
        return res.status(200).json({
          message: 'Order already exists for this idempotency key',
          data: fullOrder
        })
      }
    }

    const orderNumber = generateOrderNumber()

    const tableCheck = await checkTableAvailable(tableId, store)
    if (!tableCheck.ok) {
      return res.status(400).json({ message: tableCheck.message })
    }

    const discount = await resolveOrderDiscount({
      discountId,
      promoCode,
      customerId,
      redeemedPoints,
      store
    })
    const { discountValue, discountType, appliedDiscountId } = discount

    const pricing = await loadAndPriceOrderItems(items, store)
    if (!pricing.ok) {
      return res.status(400).json({ message: pricing.message })
    }
    const { bundleMap, productById } = pricing

    const taxRate = await getActiveTaxRate(store)
    const serviceChargeRate = await getServiceChargeRate(store)

    const {
      totals,
      promoDiscountAmount,
      appliedCampaignId,
      campaignWithSubtotal
    } = await calculateFinalTotals({
      items,
      store,
      customerId,
      discountValue,
      discountType,
      appliedDiscountId,
      appliedDiscountMeta: discount.appliedDiscountMeta,
      pointDiscountAmount: discount.pointDiscountAmount,
      taxRate,
      serviceChargeRate
    })

    const orderData = {
      orderNumber,
      store,
      tableId,
      cashierId,
      cashierName,
      customerId,
      customerName,
      customerPhone,
      notes,
      paymentMethod,
      source: source || 'pos',
      status: 'paid',
      paymentStatus: 'paid',
      subTotal: totals.subTotal,
      totalQuantity: totals.totalQuantity,
      discountType,
      discountValue,
      discountAmount: totals.discountAmount,
      discountId: appliedDiscountId,
      promoCode: promoCode || null,
      taxRate,
      taxAmount: totals.taxAmount,
      serviceChargeRate,
      serviceChargeAmount: totals.serviceChargeAmount,
      totalPrice: totals.totalPrice,
      currencyId: currencyId || null,
      currencyCode: currencyCode || null,
      exchangeRate: exchangeRate || null,
      idempotencyKey: idempotencyKey || null,
      createdBy: req.user?.id
    }
    if (await hasOrderColumn('promoCampaignId')) {
      orderData.promoCampaignId = appliedCampaignId
    }
    // Order header, its items, and the stock deduction must all commit or
    // all roll back together — previously Order.create ran outside any
    // transaction, so a stock-insufficient rejection (see deductAndTrack)
    // left a "paid" order with real items behind, with no stock actually
    // deducted and no payment ever recorded for it.
    const order = await db.sequelize.transaction(async (t) => {
      orderData.customerNumber = await generateCustomerNumber(store, t)
      const createdOrder = await Order.create(orderData, { transaction: t })

      await createOrderItems(
        createdOrder,
        items,
        bundleMap,
        productById,
        discountType,
        discountValue,
        t
      )

      await deductStockForOrder(
        createdOrder,
        items,
        bundleMap,
        store,
        orderNumber,
        req.user?.id,
        t
      )

      return createdOrder
    })

    await recordOrderPayment(order, paymentMethod, totals.totalPrice, req.user?.id)
    await createInitialOrderStatus(order, cashierName, paymentMethod, req.user?.id)
    await applyRedeemedPoints(
      order,
      customerId,
      discount.redeemedPointsUsed,
      orderNumber
    )
    await awardEarnedPoints(order, items, customerId, orderNumber, req.user?.id)
    await recordPromoUsageIfApplied(
      order,
      appliedCampaignId,
      customerId,
      promoDiscountAmount,
      campaignWithSubtotal,
      req.user?.id
    )

    const fullOrder = await Order.findOne({
      where: { id: order.id },
      include: [
        { model: OrderItem, as: 'items' },
        { model: db.transaction, as: 'transactions' }
      ]
    })

    createNotification({
      type: 'payment_received',
      store,
      referenceId: order.id,
      referenceType: 'order',
      params: [orderNumber, totals.totalPrice],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)
    createAudit(
      req,
      'create',
      'order',
      order.id,
      `Created order: ${orderNumber}`
    )

    emitNewOrder(store, fullOrder)

    await postOrderAccountingEntries(
      order,
      store,
      orderNumber,
      totals,
      paymentMethod,
      req.user?.id
    )

    return res.status(201).json({
      message: 'Order created successfully',
      data: fullOrder
    })
  } catch (error) {
    // Two requests with the same idempotencyKey can both pass the earlier
    // findOne check and both attempt to create — the unique index on
    // (store, idempotencyKey) lets exactly one succeed; the loser lands
    // here. Rather than a raw 500, return the winner's order, same as the
    // fast-path replay above.
    if (error.name === 'SequelizeUniqueConstraintError' && idempotencyKey) {
      const existing = await Order.findOne({ where: { store, idempotencyKey } })
      if (existing) {
        const fullOrder = await fetchFullOrder(existing.id)
        return res.status(200).json({
          message: 'Order already exists for this idempotency key',
          data: fullOrder
        })
      }
    }
    console.error('Error:', error)
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Internal Server Error'
    })
  }
}

// ---- createOrder helpers: persistence phase -----------------------------
// Order/pricing is decided above; everything here writes what was decided.

const createOrderItems = async (
  order,
  items,
  bundleMap,
  productById,
  discountType,
  discountValue,
  t
) => {
  for (const item of items) {
    const itemDiscountAmount = Math.max(
      0,
      (item._origSubtotal || 0) - (item.subtotal || 0)
    )
    if (item.bundleId && bundleMap[item.bundleId]) {
      const bundle = bundleMap[item.bundleId]
      // ponytail: HPP bundle = total harga komponen — kalau kosong, laporan
      // harian fallback ke harga jual sehingga food cost meleset
      const bundleCost = (bundle.items || []).reduce(
        (sum, bi) =>
          sum +
          Number(bi.productData?.costPrice ?? bi.productData?.price ?? 0) *
            Number(bi.quantity || 1),
        0
      )
      await OrderItem.create(
        {
          order: order.id,
          product: bundle.items[0]?.product || 0,
          productName: bundle.name,
          quantity: item.quantity,
          price: bundle.bundlePrice,
          bundleId: bundle.id,
          bundleName: bundle.name,
          discountType,
          discountValue,
          discountAmount: itemDiscountAmount,
          totalPrice: item.subtotal || bundle.bundlePrice * item.quantity,
          options: item.options || [],
          modifiers: item.modifiers || [],
          notes: item.notes,
          hppSnapshot: Math.round(bundleCost),
          status: 'pending'
        },
        { transaction: t }
      )
      continue
    }

    // Reuses the product already fetched in loadAndPriceOrderItems instead
    // of fetching the same row a third time.
    const product = productById.get(item.product || item.productId)
    const costPrice = product
      ? Number(product.costPrice || product.price || 0)
      : 0
    await OrderItem.create(
      {
        order: order.id,
        product: item.product || item.productId,
        productName: item.productName || product?.nameProduct,
        quantity: item.quantity,
        price: item.price || item.basePrice,
        discountType,
        discountValue,
        discountAmount: itemDiscountAmount,
        totalPrice: item.subtotal || item.totalPrice,
        options: item.options || [],
        modifiers: item.modifiers || [],
        notes: item.notes,
        hppSnapshot: costPrice,
        status: 'pending'
      },
      { transaction: t }
    )
  }
}

// Reduce stock & create stock history — wrapped in a transaction for
// atomicity. Locks every distinct product touched by the order (bundle
// components and regular items alike) in one query, in a stable order,
// instead of one findByPk+lock per line — the same fix already applied to
// checkout.js's equivalent loop.
// Takes the same transaction `t` that created the order and its items, so
// an insufficient-stock rejection here (see deductAndTrack below) rolls
// back the order + items too, instead of leaving a "paid" order behind
// with no stock ever deducted and no payment ever recorded for it.
const deductStockForOrder = async (
  order,
  items,
  bundleMap,
  store,
  orderNumber,
  userId,
  t
) => {
  {
    const productIdSet = new Set()
    for (const item of items) {
      if (item.bundleId && bundleMap[item.bundleId]) {
        for (const bi of bundleMap[item.bundleId].items) {
          productIdSet.add(bi.product)
        }
      } else {
        const pid = item.product || item.productId
        if (pid) productIdSet.add(pid)
      }
    }
    const productIds = [...productIdSet].sort((a, b) => a - b)
    const products = productIds.length
      ? await Product.findAll({
          where: { id: productIds },
          transaction: t,
          lock: t.LOCK.UPDATE
        })
      : []
    const productById = new Map(products.map((p) => [p.id, p]))

    const stockHistoryRows = []

    const deductAndTrack = async ({
      product,
      deductQty,
      referenceNote,
      sellName
    }) => {
      const oldStock = Number(product.stock) || 0
      // Re-validate against the value just read under the row lock, not the
      // unlocked pre-check earlier in the request — two concurrent orders
      // can both pass that pre-check for the last unit, then both reach
      // here; without this, both would silently succeed (the old code
      // clamped to 0 instead of rejecting), selling more than was in stock.
      if (oldStock < deductQty) {
        const err = new Error(
          `Stok "${product.nameProduct || 'produk'}" tidak mencukupi. Tersedia: ${oldStock}, diminta: ${deductQty}`
        )
        err.statusCode = 400
        throw err
      }
      const newStock = oldStock - deductQty
      await product.update(
        { stock: db.sequelize.literal(`GREATEST(stock - ${deductQty}, 0)`) },
        { transaction: t }
      )
      // Keep the in-memory row consistent so a second reference to the
      // same product later in this loop (another line, or another
      // component of a different bundle) sees the already-decremented
      // stock.
      product.stock = newStock

      await db.sequelize.query(
        `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
         VALUES ($1, $2, 0, NOW(), NOW())
         ON CONFLICT (product, store) DO NOTHING`,
        { bind: [product.id, store], transaction: t }
      )
      await db.product_store_stock.update(
        { stock: db.sequelize.literal(`GREATEST(stock - ${deductQty}, 0)`) },
        { where: { product: product.id, store }, transaction: t }
      )

      // ponytail: FIFO - consume oldest batches first
      await batchService.deductFifo({
        productId: product.id,
        store,
        qty: deductQty,
        transaction: t
      })

      stockHistoryRows.push({
        product: product.id,
        store,
        referenceType: 'sale',
        referenceId: order.id,
        quantityBefore: oldStock,
        quantityChange: -deductQty,
        quantityAfter: newStock,
        unit: product.unit || 'pcs',
        notes: referenceNote,
        createdBy: userId
      })

      // Race-safe upsert instead of findOne + conditional create/update,
      // which could double-insert under concurrent orders touching the
      // same product/store.
      await db.sequelize.query(
        `INSERT INTO best_selling ("productId", "nameProduct", image, store, "totalSelling", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT ("productId", store) WHERE "deletedAt" IS NULL
         DO UPDATE SET
           "totalSelling" = best_selling."totalSelling" + EXCLUDED."totalSelling",
           "nameProduct" = EXCLUDED."nameProduct",
           image = EXCLUDED.image,
           "updatedAt" = NOW()`,
        {
          bind: [
            product.id,
            sellName,
            product.image || null,
            store,
            deductQty
          ],
          transaction: t
        }
      )
    }

    for (const item of items) {
      if (item.bundleId && bundleMap[item.bundleId]) {
        // Bundle: deduct stock for each component product
        const bundle = bundleMap[item.bundleId]
        const bundleQty = Number(item.quantity) || 1
        for (const bi of bundle.items) {
          const product = productById.get(bi.product)
          if (!product) continue
          await deductAndTrack({
            product,
            deductQty: bi.quantity * bundleQty,
            referenceNote: `Penjualan bundle: ${bundle.name} (${orderNumber})`,
            sellName: product.nameProduct
          })
        }
        continue
      }

      // Regular product item
      const product = productById.get(item.product || item.productId)
      if (!product) continue

      await deductAndTrack({
        product,
        deductQty: Math.floor(Number(item.quantity)) || 0,
        referenceNote: `Penjualan: ${orderNumber}`,
        sellName: item.productName || product.nameProduct
      })
    }

    if (stockHistoryRows.length) {
      await db.stock_history.bulkCreate(stockHistoryRows, {
        transaction: t
      })
    }
  }
}

const recordOrderPayment = async (order, paymentMethod, totalPrice, userId) => {
  if (!paymentMethod) return
  await db.transaction.create({
    order: order.id,
    typePayment: paymentMethod,
    amount: totalPrice,
    createdBy: userId
  })
}

const createInitialOrderStatus = async (
  order,
  cashierName,
  paymentMethod,
  userId
) => {
  await OrderStatus.create({
    order: order.id,
    status: 'paid',
    createdBy: userId,
    notes: `Paid by ${cashierName} via ${paymentMethod || 'cash'}`
  })
}

const applyRedeemedPoints = async (
  order,
  customerId,
  redeemedPointsUsed,
  orderNumber
) => {
  if (!(redeemedPointsUsed > 0 && customerId)) return
  try {
    const member = await db.member.findByPk(customerId)
    if (member) {
      const oldPoints = Number(member.totalPoints) || 0
      const newPoints = oldPoints - redeemedPointsUsed
      await member.update({ totalPoints: Math.max(0, newPoints) })
      await db.member_point_history.create({
        member: customerId,
        pointsChange: -redeemedPointsUsed,
        pointsBefore: oldPoints,
        pointsAfter: Math.max(0, newPoints),
        transactionId: order.id,
        notes: `Redeemed ${redeemedPointsUsed} points for order ${orderNumber}`
      })
    }
  } catch (e) {
    console.error('Point deduction error:', e.message)
  }
}

const awardEarnedPoints = async (order, items, customerId, orderNumber, userId) => {
  if (!customerId) return
  try {
    const productIds = [
      ...new Set(items.map((i) => i.product || i.productId))
    ]
    const products = await Product.findAll({
      where: { id: productIds },
      attributes: ['id', 'point']
    })
    const pointMap = Object.fromEntries(
      products.map((p) => [p.id, Number(p.point) || 0])
    )
    const pointsEarned = items.reduce((sum, item) => {
      const pid = item.product || item.productId
      return sum + (pointMap[pid] || 0) * Number(item.quantity)
    }, 0)

    if (pointsEarned > 0) {
      const member = await db.member.findByPk(customerId)
      if (member) {
        const oldTotal = Number(member.totalPoints) || 0
        const oldLifetime = Number(member.lifetimePoints) || 0
        const newTotal = oldTotal + pointsEarned
        await member.update({
          totalPoints: newTotal,
          lifetimePoints: oldLifetime + pointsEarned
        })

        // ponytail: prefer exact min≤total≤max match; fall back to highest minPoints (gap scenario)
        const Op = require('sequelize').Op
        let targetTier = await db.member_tier.findOne({
          where: {
            status: 'active',
            minPoints: { [Op.lte]: newTotal },
            maxPoints: { [Op.gte]: newTotal }
          },
          order: [['minPoints', 'DESC']]
        })
        if (!targetTier) {
          targetTier = await db.member_tier.findOne({
            where: { status: 'active', minPoints: { [Op.lte]: newTotal } },
            order: [['minPoints', 'DESC']]
          })
        }
        if (targetTier) {
          const currentTierRow = member.tier
            ? await db.member_tier.findByPk(member.tier)
            : null
          const currentMin = Number(currentTierRow?.minPoints || -1)
          if (Number(targetTier.minPoints) > currentMin) {
            await member.update({ tier: targetTier.id })
          }
        }

        await db.member_point_history.create({
          member: customerId,
          pointsChange: pointsEarned,
          pointsBefore: oldTotal,
          pointsAfter: oldTotal + pointsEarned,
          transactionId: order.id,
          notes: `Earned ${pointsEarned} points from order ${orderNumber}`,
          createdBy: userId
        })
      }
    }
  } catch (e) {
    console.error('Point earning error:', e.message)
  }
}

const recordPromoUsageIfApplied = async (
  order,
  appliedCampaignId,
  customerId,
  promoDiscountAmount,
  campaignWithSubtotal,
  userId
) => {
  if (!appliedCampaignId) return
  try {
    const campaign = await db.promo_campaign.findByPk(appliedCampaignId)
    if (campaign) {
      await db.promo_usage.create({
        store: campaign.store,
        campaignId: appliedCampaignId,
        orderId: order.id,
        memberId: customerId || null,
        discountApplied: promoDiscountAmount,
        freeItemsGiven: campaignWithSubtotal.reward
          ? [
              {
                productId: campaignWithSubtotal.reward.productId,
                quantity: campaignWithSubtotal.reward.quantity
              }
            ]
          : null,
        appliedAt: new Date(),
        createdBy: userId
      })
      await campaign.update({
        currentUsage: (campaign.currentUsage || 0) + 1
      })
    }
  } catch (e) {
    console.error('Promo usage recording error:', e.message)
  }
}

const postOrderAccountingEntries = async (
  order,
  store,
  orderNumber,
  totals,
  paymentMethod,
  userId
) => {
  try {
    const {
      postOrderJournal,
      postOrderCogsJournal
    } = require('../service/accountingService')
    await postOrderJournal({
      store,
      orderId: order.id,
      orderNumber,
      subTotal: totals.subTotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      serviceChargeAmount: totals.serviceChargeAmount,
      totalPrice: totals.totalPrice,
      date: new Date(),
      paymentMethod,
      createdBy: userId
    })
    await postOrderCogsJournal({
      store,
      orderId: order.id,
      orderNumber,
      date: new Date(),
      createdBy: userId
    })
  } catch (e) {
    console.error('Accounting posting skipped:', e.message)
  }
}

exports.getOrdersByStore = async (req, res) => {
  const { store, status, date, table, startDate, endDate, page, limit } =
    req.query

  try {
    const reqStore =
      req.user?.roleType === 'super_admin'
        ? req.storeId || store || null
        : req.storeId || req.user?.store || null
    const where = {}
    if (reqStore) where.store = reqStore
    if (status) where.status = status
    if (req.query.source) where.source = req.query.source
    if (req.query.paymentStatus) where.paymentStatus = req.query.paymentStatus
    if (date) {
      where.createdAt = {
        [require('sequelize').Op.gte]: new Date(date + ' 00:00:00'),
        [require('sequelize').Op.lte]: new Date(date + ' 23:59:59')
      }
    }
    if (startDate && endDate) {
      where.createdAt = {
        [require('sequelize').Op.gte]: new Date(startDate + ' 00:00:00'),
        [require('sequelize').Op.lte]: new Date(endDate + ' 23:59:59')
      }
    }
    if (table) {
      where.tableId = table
    }

    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 50
    const offset = (pageNum - 1) * limitNum

    const queryOptions = {
      where,
      include: [
        {
          model: OrderItem,
          as: 'items'
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset
    }

    const orderAttributes = await getOrderAttributes()
    if (orderAttributes) queryOptions.attributes = orderAttributes

    const { count: total, rows: orders } =
      await Order.findAndCountAll(queryOptions)

    return res.status(200).json({
      message: 'Success',
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getOrderById = async (req, res) => {
  const { id } = req.params

  try {
    const orderAttributes = await getOrderAttributes()
    const reqStore =
      req.user?.roleType === 'super_admin'
        ? req.storeId || null
        : req.storeId || req.user?.store || null
    const order = await Order.findOne({
      where: { id, ...(reqStore ? { store: reqStore } : {}) },
      include: [
        { model: OrderItem, as: 'items' },
        { model: OrderStatus, as: 'statusHistory' },
        { model: Table, as: 'table' }
      ],
      ...(orderAttributes ? { attributes: orderAttributes } : {})
    })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    return res.status(200).json({
      message: 'Success',
      data: order
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.updateOrderStatus = async (req, res) => {
  const { id, status, changedBy, changedByName, notes } = req.body
  const store =
    req.user?.roleType === 'super_admin'
      ? req.storeId || req.body.store || null
      : req.storeId || req.user?.store || null

  try {
    const statusAttrs = await getOrderAttributes()
    const order = await Order.findOne({
      where: { id, ...(store ? { store } : {}) },
      ...(statusAttrs ? { attributes: statusAttrs } : {})
    })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    // Used outside the transaction below (accounting posting, which is
    // already dedup-guarded by referenceId). The guards that actually
    // decide whether to mutate stock use a fresh, row-locked read taken
    // inside the transaction instead — see lockedOrder below.
    const oldStatus = order.status
    const effectiveStore = store || order.store || null

    // Reduce stock exactly once when an order transitions to paid. Orders that
    // were already paid & deducted at creation (paymentStatus 'paid') are skipped.
    const deductPaidOrderStock = async (t) => {
      const items = await OrderItem.findAll({
        where: { order: id },
        transaction: t
      })
      if (items.length === 0) return

      // Lock every distinct product once, in a stable order, instead of one
      // findByPk+lock per item.
      const productIds = [
        ...new Set(items.map((it) => it.product).filter(Boolean))
      ].sort((a, b) => a - b)
      const products = await Product.findAll({
        where: { id: productIds },
        transaction: t,
        lock: t.LOCK.UPDATE
      })
      const productById = new Map(products.map((p) => [p.id, p]))

      const stockHistoryRows = []

      for (const item of items) {
        const product = productById.get(item.product)
        if (!product) continue

        const oldStock = Number(product.stock) || 0
        const qty = Math.floor(Number(item.quantity)) || 0
        const newStock = Math.max(oldStock - qty, 0)
        await product.update(
          {
            stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`)
          },
          { transaction: t }
        )
        product.stock = newStock

        // ponytail: atomic upsert + deduct per-store stock
        await db.sequelize.query(
          `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
           VALUES ($1, $2, 0, NOW(), NOW())
           ON CONFLICT (product, store) DO NOTHING`,
          { bind: [item.product, effectiveStore], transaction: t }
        )
        await db.product_store_stock.update(
          {
            stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`)
          },
          {
            where: { product: item.product, store: effectiveStore },
            transaction: t
          }
        )

        // ponytail: FIFO - consume oldest batches first
        await batchService.deductFifo({
          productId: product.id,
          store: effectiveStore,
          qty,
          transaction: t
        })

        stockHistoryRows.push({
          product: product.id,
          store: effectiveStore,
          referenceType: 'sale',
          referenceId: order.id,
          quantityBefore: oldStock,
          quantityChange: -Number(item.quantity),
          quantityAfter: newStock,
          unit: product.unit || 'pcs',
          notes: `Penjualan: ${order.orderNumber}`,
          createdBy: changedBy
        })

        const sellName = item.productName || product.nameProduct
        await db.sequelize.query(
          `INSERT INTO best_selling ("productId", "nameProduct", image, store, "totalSelling", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT ("productId", store) WHERE "deletedAt" IS NULL
           DO UPDATE SET
             "totalSelling" = best_selling."totalSelling" + EXCLUDED."totalSelling",
             "nameProduct" = EXCLUDED."nameProduct",
             image = EXCLUDED.image,
             "updatedAt" = NOW()`,
          {
            bind: [
              product.id,
              sellName,
              product.image || null,
              effectiveStore,
              Number(item.quantity) || 0
            ],
            transaction: t
          }
        )
      }

      if (stockHistoryRows.length) {
        await db.stock_history.bulkCreate(stockHistoryRows, {
          transaction: t
        })
      }
    }

    // Restore stock when an order is cancelled/voided.
    const reverseOrderStock = async (t) => {
      const items = await OrderItem.findAll({
        where: { order: id },
        transaction: t
      })

      for (const item of items) {
        const product = await Product.findByPk(item.product, {
          transaction: t
        })
        if (!product) continue

        const oldStock = Number(product.stock) || 0
        const qty = Math.floor(Number(item.quantity)) || 0
        const newStock = oldStock + qty
        await product.update(
          { stock: db.sequelize.literal(`stock + ${qty}`) },
          { transaction: t }
        )

        // ponytail: atomic restore per-store stock
        await db.sequelize.query(
          `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
           VALUES ($1, $2, 0, NOW(), NOW())
           ON CONFLICT (product, store) DO NOTHING`,
          { bind: [item.product, effectiveStore], transaction: t }
        )
        await db.product_store_stock.update(
          { stock: db.sequelize.literal(`stock + ${qty}`) },
          {
            where: { product: item.product, store: effectiveStore },
            transaction: t
          }
        )

        await db.stock_history.create(
          {
            product: product.id,
            store: effectiveStore,
            referenceType: 'sale_reversal',
            referenceId: order.id,
            quantityBefore: oldStock,
            quantityChange: Number(item.quantity),
            quantityAfter: newStock,
            unit: product.unit || 'pcs',
            notes: `Pembatalan: ${order.orderNumber}`,
            createdBy: changedBy
          },
          { transaction: t }
        )

        const sellName = item.productName || product.nameProduct
        const findBs = await db.best_selling.findOne({
          where: {
            productId: product.id,
            nameProduct: sellName,
            store: effectiveStore
          },
          transaction: t
        })
        if (findBs) {
          await db.best_selling.update(
            {
              totalSelling: Math.max(
                0,
                Number(findBs.totalSelling) - Number(item.quantity)
              )
            },
            {
              where: {
                productId: product.id,
                nameProduct: sellName
              },
              transaction: t
            }
          )
        }
      }
    }

    // Perform the whole status transition atomically.
    await db.sequelize.transaction(async (t) => {
      // Re-read the order under a row lock and derive oldStatus/
      // oldPaymentStatus from THIS fresh read, shadowing the stale
      // pre-transaction values above. Two concurrent status-change requests
      // for the same order (a double-tap, or a client retry after a
      // timeout) previously both read the order before either had
      // committed, so both saw paymentStatus !== 'paid' and both deducted
      // stock — a real double-deduction, not just a duplicate-payment risk
      // (which was already guarded by a fresh existingTxn check below).
      const lockedOrder = await Order.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
        ...(statusAttrs ? { attributes: statusAttrs } : {})
      })
      const oldStatus = lockedOrder.status
      const oldPaymentStatus = lockedOrder.paymentStatus

      await order.update(
        {
          status,
          ...(status === 'paid' ? { paymentStatus: 'paid' } : {})
        },
        { transaction: t }
      )

      await OrderStatus.create(
        {
          order: id,
          status,
          createdBy: changedBy,
          notes: notes || (changedByName ? `By ${changedByName}` : null)
        },
        { transaction: t }
      )

      // If transitioning to paid, record payment & reduce stock exactly once
      if (status === 'paid' && oldStatus !== 'paid') {
        const existingTxn = await db.transaction.findOne({
          where: { order: id },
          transaction: t
        })
        if (!existingTxn) {
          await db.transaction.create(
            {
              order: id,
              typePayment: order.paymentMethod || 'cash',
              amount: Number(order.totalPrice) || 0,
              createdBy: changedBy || req.user?.id
            },
            { transaction: t }
          )
        }

        // Skip deduction for orders already paid & deducted at creation
        if (oldPaymentStatus !== 'paid') {
          await deductPaidOrderStock(t)
        }
      }

      // If transitioning to cancelled/void, reverse stock
      if (
        ['cancelled', 'void'].includes(status) &&
        !['cancelled', 'void'].includes(oldStatus)
      ) {
        const approvedReturn = await db.sales_return.findOne({
          where: { order: id, status: 'approved' },
          transaction: t
        })
        if (approvedReturn) {
          const err = new Error(
            'Cannot void/cancel this order because it has an approved sales return. Process a separate return reversal first.'
          )
          err.statusCode = 400
          throw err
        }
        await reverseOrderStock(t)
      }

      if (order.tableId && ['paid', 'cancelled', 'void'].includes(status)) {
        await Table.update(
          { status: 'available' },
          { where: { id: order.tableId }, transaction: t }
        )
      }
    })

    // Post sales + COGS journals when an order becomes paid (deduped by referenceId).
    if (status === 'paid' && oldStatus !== 'paid') {
      try {
        const {
          postOrderJournal,
          postOrderCogsJournal
        } = require('../service/accountingService')
        await postOrderJournal({
          store: effectiveStore,
          orderId: id,
          orderNumber: order.orderNumber,
          subTotal: order.subTotal,
          discountAmount: order.discountAmount,
          taxAmount: order.taxAmount,
          serviceChargeAmount: order.serviceChargeAmount,
          totalPrice: order.totalPrice,
          date: new Date(),
          paymentMethod: order.paymentMethod,
          createdBy: changedBy || req.user?.id
        })
        await postOrderCogsJournal({
          store: effectiveStore,
          orderId: id,
          orderNumber: order.orderNumber,
          date: new Date(),
          createdBy: changedBy || req.user?.id
        })
      } catch (e) {
        console.error('Accounting posting skipped:', e.message)
      }
    }

    // Reverse revenue + COGS journals when an order is cancelled/voided.
    if (
      ['cancelled', 'void'].includes(status) &&
      !['cancelled', 'void'].includes(oldStatus)
    ) {
      try {
        const { reverseOrderJournals } = require('../service/accountingService')
        await reverseOrderJournals({
          store: effectiveStore,
          orderId: id,
          orderNumber: order.orderNumber,
          date: new Date(),
          createdBy: changedBy || req.user?.id
        })
      } catch (e) {
        console.error('Accounting reversal skipped:', e.message)
      }
    }

    createAudit(req, 'update', 'order', id, `Updated order status to ${status}`)

    return res.status(200).json({
      message: 'Order status updated',
      data: order
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Internal Server Error'
    })
  }
}

exports.updateOrderItemStatus = async (req, res) => {
  const { id, itemId, itemStatus } = req.body

  try {
    const item = await OrderItem.findOne({ where: { id: itemId, order: id } })

    if (!item) {
      return res.status(404).json({
        message: 'Item not found'
      })
    }

    await item.update({ status: itemStatus })

    const orderAttrs = await getOrderAttributes()
    const order = await Order.findByPk(
      id,
      orderAttrs ? { attributes: orderAttrs } : undefined
    )
    if (order) {
      emitItemStatusUpdate(order.store, id, item)
    }

    const allItems = await OrderItem.findAll({ where: { order: id } })
    const allSameStatus = allItems.every((i) => i.status === itemStatus)

    if (allSameStatus) {
      const statusMap = {
        pending: 'pending',
        preparing: 'preparing',
        ready: 'ready',
        served: 'served'
      }
      await Order.update({ status: statusMap[itemStatus] }, { where: { id } })
    }

    return res.status(200).json({
      message: 'Item status updated',
      data: item
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getKitchenOrders = async (req, res) => {
  const { store } = req.query

  try {
    // ponytail: order-level status is 'paid' at POS — kitchen cares about item status only
    // QR orders should only appear in kitchen after being accepted (status != pending/cancelled/void)
    const whereClause = store ? { store } : {}
    whereClause[Op.or] = [
      { source: { [Op.ne]: 'qr' } },
      { source: { [Op.is]: null } },
      { status: { [Op.notIn]: ['pending', 'cancelled', 'void'] } }
    ]
    const orderAttributes = await getOrderAttributes()
    const orders = await Order.findAll({
      where: whereClause,
      include: [
        {
          model: OrderItem,
          as: 'items',
          where: {
            status: {
              [Op.in]: ['pending', 'preparing', 'ready']
            }
          }
        }
      ],
      order: [['createdAt', 'DESC']],
      ...(orderAttributes ? { attributes: orderAttributes } : {})
    })

    return res.status(200).json({
      message: 'Success',
      data: orders
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getCustomerMenu = async (req, res) => {
  const { store } = req.query

  try {
    if (!store) {
      return res.status(400).json({ message: 'store is required' })
    }

    const Op = require('sequelize').Op
    const storeId = Number(store)
    if (isNaN(storeId)) {
      return res.status(400).json({ message: 'Invalid store value' })
    }

    const productWhere = { status: 'active' }
    const categoryWhere = { status: 'active' }

    if (await hasTable('product_store')) {
      const productStoreSub = db.sequelize.literal(
        `EXISTS (SELECT 1 FROM product_store WHERE product = "product".id AND store = ${storeId} AND "deletedAt" IS NULL)`
      )
      const productUnassignedSub = db.sequelize.literal(
        `NOT EXISTS (SELECT 1 FROM product_store WHERE product = "product".id AND "deletedAt" IS NULL)`
      )
      productWhere[Op.or] = [productStoreSub, productUnassignedSub]
    }

    if (await hasTable('category_store')) {
      const categoryStoreSub = db.sequelize.literal(
        `EXISTS (SELECT 1 FROM category_store WHERE category = "category".id AND store = ${storeId} AND "deletedAt" IS NULL)`
      )
      const categoryUnassignedSub = db.sequelize.literal(
        `NOT EXISTS (SELECT 1 FROM category_store WHERE category = "category".id AND "deletedAt" IS NULL)`
      )
      categoryWhere[Op.or] = [categoryStoreSub, categoryUnassignedSub]
    }

    const products = await db.product.findAll({
      where: productWhere,
      include: [
        { model: db.category, as: 'categoryData', attributes: ['name'] }
      ],
      order: [
        ['categoryData', 'name', 'ASC'],
        ['nameProduct', 'ASC']
      ]
    })

    const categories = await db.category.findAll({
      where: categoryWhere,
      order: [['name', 'ASC']]
    })

    return res.status(200).json({
      message: 'Success',
      data: { products, categories }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

exports.createCustomerOrder = async (req, res) => {
  const {
    store,
    tableId,
    items,
    customerName,
    notes,
    customerId,
    paymentMethod,
    splitCount,
    session,
    idempotencyKey
  } = req.body

  try {
    if (!store || !items || !items.length) {
      return res.status(400).json({ message: 'store and items are required' })
    }

    // Public, unauthenticated endpoint on a QR-ordering flow — flaky mobile
    // networks make client retries routine. Same replay pattern as
    // createOrder: a retried submit with the same key returns the order
    // already created instead of creating a second one.
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ where: { store, idempotencyKey } })
      if (existingOrder) {
        const fullOrder = await fetchFullOrder(existingOrder.id)
        return res.status(200).json({
          message: 'Order already exists for this idempotency key',
          data: fullOrder
        })
      }
    }

    const orderNumber =
      'CUST-' +
      Date.now().toString().slice(-8) +
      Math.random().toString(36).slice(2, 6).toUpperCase()

    const table = tableId
      ? await db.table.findOne({ where: { id: tableId, store } })
      : null
    if (tableId && !table) {
      return res.status(400).json({ message: 'Table not found' })
    }
    if (
      table &&
      ['occupied', 'reserved', 'maintenance'].includes(table.status)
    ) {
      return res.status(400).json({
        message:
          table.status === 'occupied'
            ? 'Table is already occupied'
            : 'Table is not available'
      })
    }

    let member = null
    if (customerId) {
      member = await db.member.findByPk(customerId)
    } else if (customerName) {
      member = await db.member.findOne({
        where: {
          name: { [Op.iLike]: customerName.trim() },
          store,
          status: 'active'
        }
      })
    }

    let discountValue = 0
    let discountType = 'none'

    if (member && member.tier) {
      const tier = await db.member_tier.findByPk(member.tier)
      if (tier && tier.discountPercent > 0) {
        discountValue = tier.discountPercent
        discountType = 'percent'
      }
    }

    // Pre-load bundles
    const bundleMap = {}
    for (const item of items) {
      if (item.bundleId) {
        const bundle = await db.product_bundle.findByPk(item.bundleId, {
          include: [
            {
              model: db.product_bundle_item,
              as: 'items',
              include: [{ model: Product, as: 'productData' }]
            }
          ]
        })
        if (
          !bundle ||
          !bundle.isAvailable ||
          bundle.status !== 'active' ||
          !isBundleWithinValidityPeriod(bundle)
        ) {
          return res.status(400).json({
            message: `Bundle not available: ${item.bundleName || item.bundleId}`
          })
        }
        bundleMap[item.bundleId] = bundle
      }
    }

    // ===== SERVER-SIDE PRICE VALIDATION =====
    // Re-calculate all prices from DB. Never trust FE-sent prices.
    for (const item of items) {
      if (item.bundleId && bundleMap[item.bundleId]) {
        const bundle = bundleMap[item.bundleId]
        const serverPrice = Number(bundle.bundlePrice) || 0
        item.price = serverPrice
        item.subtotal = serverPrice * Number(item.quantity)
      } else if (item.productId) {
        const prod = await Product.findByPk(item.productId)
        if (!prod) {
          return res.status(400).json({
            message: `Product not found: ${item.productName || item.productId}`
          })
        }
        const serverPrice = getServerItemPrice(prod, item)
        item.basePrice = Number(prod.price) || 0
        item.price = serverPrice
        item.subtotal = serverPrice * Number(item.quantity)
      }
    }

    // Validate bundle component stock
    for (const item of items) {
      if (item.bundleId && bundleMap[item.bundleId]) {
        const bundle = bundleMap[item.bundleId]
        const bundleQty = Number(item.quantity) || 1
        for (const bi of bundle.items) {
          const prod = bi.productData
          if (!prod) {
            return res
              .status(400)
              .json({ message: `Product in bundle "${bundle.name}" not found` })
          }
          const needed = bi.quantity * bundleQty
          const avail = await getEffectiveStock(prod, store)
          if (avail !== null && avail < needed) {
            return res.status(400).json({
              message: `Stok "${prod.nameProduct}" tidak mencukupi untuk bundle "${bundle.name}". Tersedia: ${avail}, dibutuhkan: ${needed}`
            })
          }
        }
      }
    }

    // Validate regular product stock
    for (const item of items) {
      if (item.bundleId) continue
      const prod = item.productId
        ? await Product.findByPk(item.productId)
        : null
      if (!prod) {
        return res.status(400).json({
          message: `Product not found: ${item.productName || item.productId}`
        })
      }
      const avail = await getEffectiveStock(prod, store)
      if (avail !== null && avail < Number(item.quantity)) {
        return res.status(400).json({
          message: `Stok "${prod.nameProduct}" tidak mencukupi. Tersedia: ${avail}, diminta: ${item.quantity}`
        })
      }
    }

    // Build items & subtotal
    let subTotal = 0
    let totalQuantity = 0
    const orderItems = []
    for (const item of items) {
      if (item.bundleId && bundleMap[item.bundleId]) {
        const bundle = bundleMap[item.bundleId]
        const subtotal = bundle.bundlePrice * item.quantity
        subTotal += subtotal
        totalQuantity += item.quantity
        // ponytail: HPP bundle = total harga komponen — kalau kosong, laporan
        // harian fallback ke harga jual sehingga food cost meleset
        const bundleCost = (bundle.items || []).reduce(
          (sum, bi) =>
            sum +
            Number(bi.productData?.costPrice ?? bi.productData?.price ?? 0) *
              Number(bi.quantity || 1),
          0
        )
        orderItems.push({
          product: bundle.items[0]?.product || 0,
          productName: bundle.name,
          quantity: item.quantity,
          price: bundle.bundlePrice,
          bundleId: bundle.id,
          bundleName: bundle.name,
          totalPrice: subtotal,
          hppSnapshot: Math.round(bundleCost),
          notes: item.notes || null,
          options: item.options || [],
          modifiers: item.modifiers || [],
          status: 'pending'
        })
      } else {
        const subtotal = item.price * item.quantity
        subTotal += subtotal
        totalQuantity += item.quantity
        const prod = item.productId
          ? await Product.findByPk(item.productId)
          : null
        const costPrice = prod ? Number(prod.costPrice || prod.price || 0) : 0
        orderItems.push({
          product: item.productId,
          productName: item.productName || prod?.nameProduct || 'Item',
          quantity: item.quantity,
          price: item.price,
          totalPrice: subtotal,
          hppSnapshot: costPrice,
          notes: item.notes || null,
          options: item.options || [],
          modifiers: item.modifiers || [],
          status: 'pending'
        })
      }
    }

    // Evaluate promo campaigns
    const campaignResult = await evaluatePromoCampaign(
      items.map((item) => ({
        ...item,
        productId: item.productId || item.product,
        unitPrice: item.price ?? 0,
        subtotal: item.price * item.quantity
      })),
      store,
      member ? member.id : null,
      subTotal
    )

    let discountAmount = 0
    let appliedCampaignId = null
    if (campaignResult.discountAmount > 0) {
      discountAmount = campaignResult.discountAmount
      appliedCampaignId = campaignResult.campaignId
      discountType = 'nominal'
    } else if (discountType === 'percent') {
      discountAmount = Math.round(subTotal * (discountValue / 100))
    }

    const afterDiscount = subTotal - discountAmount
    const taxRate = await getActiveTaxRate(store)
    const taxAmount = Math.round(afterDiscount * (taxRate / 100))
    const totalPrice = afterDiscount + taxAmount

    const qrOrderData = {
      orderNumber,
      store,
      tableId: tableId || null,
      customerId: member ? member.id : null,
      cashierId: null,
      cashierName: customerName || 'Customer',
      customerName: customerName || null,
      notes,
      source: 'qr',
      status: 'pending',
      subTotal,
      totalQuantity,
      discountType,
      discountValue,
      discountAmount,
      taxRate,
      taxAmount,
      serviceChargeAmount: 0,
      totalPrice,
      paymentMethod: paymentMethod || null,
      paymentStatus: paymentMethod ? 'paid' : 'unpaid',
      splitCount: splitCount || null,
      idempotencyKey: idempotencyKey || null
    }
    if (await hasOrderColumn('promoCampaignId')) {
      qrOrderData.promoCampaignId = appliedCampaignId
    }
    if (await hasOrderColumn('session')) {
      qrOrderData.session = session || null
    }
    // Deduct stock only when the order is paid immediately. Unpaid orders
    // have their stock deducted exactly once when they transition to paid.
    const deductStock = qrOrderData.paymentStatus === 'paid'

    // Order header, its items, and (when paid immediately) the stock
    // deduction all commit or roll back together — previously the order +
    // items + payment record + accounting entries were all written before
    // stock deduction even ran in its own separate transaction, so an
    // insufficient-stock rejection there left a "paid" order with a real
    // payment record behind, despite no stock ever having been deducted.
    const order = await db.sequelize.transaction(async (t) => {
      qrOrderData.customerNumber = await generateCustomerNumber(store, t)
      const createdOrder = await db.order.create(qrOrderData, { transaction: t })

      for (const item of orderItems) {
        await db.order_item.create(
          { ...item, order: createdOrder.id },
          { transaction: t }
        )
      }

      if (deductStock) {
        // Lock every distinct product touched by this order in one query,
        // in a stable (sorted) order — was one findByPk+lock per
        // component/item in whatever order the cart listed them, which
        // could deadlock against another concurrent order locking the same
        // two products in the opposite order.
        const productIdSet = new Set()
        for (const item of items) {
          if (item.bundleId && bundleMap[item.bundleId]) {
            for (const bi of bundleMap[item.bundleId].items) {
              productIdSet.add(bi.product)
            }
          } else if (item.productId) {
            productIdSet.add(item.productId)
          }
        }
        const productIds = [...productIdSet].sort((a, b) => a - b)
        const products = productIds.length
          ? await Product.findAll({
              where: { id: productIds },
              transaction: t,
              lock: t.LOCK.UPDATE
            })
          : []
        const productById = new Map(products.map((p) => [p.id, p]))

        const deductAndTrack = async ({ product, deductQty, referenceNote }) => {
          const oldStock = Number(product.stock) || 0
          // Re-validate against the freshly locked value — two concurrent
          // customer orders can both pass the earlier, unlocked stock
          // pre-check for the last unit; without this, both would silently
          // succeed (the old code clamped to 0 instead of rejecting),
          // overselling the item.
          if (oldStock < deductQty) {
            const err = new Error(
              `Stok "${product.nameProduct || 'produk'}" tidak mencukupi. Tersedia: ${oldStock}, diminta: ${deductQty}`
            )
            err.statusCode = 400
            throw err
          }
          const newStock = oldStock - deductQty
          await product.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${deductQty}, 0)`) },
            { transaction: t }
          )
          product.stock = newStock

          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [product.id, store], transaction: t }
          )
          await db.product_store_stock.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${deductQty}, 0)`) },
            { where: { product: product.id, store }, transaction: t }
          )

          // ponytail: FIFO - consume oldest batches first
          await batchService.deductFifo({
            productId: product.id,
            store,
            qty: deductQty,
            transaction: t
          })

          await db.stock_history.create(
            {
              product: product.id,
              store,
              referenceType: 'sale',
              referenceId: createdOrder.id,
              quantityBefore: oldStock,
              quantityChange: -deductQty,
              quantityAfter: newStock,
              unit: product.unit || 'pcs',
              notes: referenceNote,
              createdBy: req.user?.id
            },
            { transaction: t }
          )
        }

        for (const item of items) {
          if (item.bundleId && bundleMap[item.bundleId]) {
            const bundle = bundleMap[item.bundleId]
            const bundleQty = Number(item.quantity) || 1
            for (const bi of bundle.items) {
              const product = productById.get(bi.product)
              if (!product) continue
              await deductAndTrack({
                product,
                deductQty: bi.quantity * bundleQty,
                referenceNote: `Penjualan bundle: ${bundle.name} (${orderNumber})`
              })
            }
            continue
          }

          const product = item.productId ? productById.get(item.productId) : null
          if (!product) continue

          await deductAndTrack({
            product,
            deductQty: Math.floor(Number(item.quantity)) || 0,
            referenceNote: `Penjualan: ${orderNumber}`
          })
        }
      }

      return createdOrder
    })

    // Record payment transaction + accounting entries only after the order,
    // its items, and its stock deduction have all committed successfully.
    if (deductStock) {
      await db.transaction.create({
        order: order.id,
        typePayment: paymentMethod || 'cash',
        amount: Number(order.totalPrice) || 0,
        createdBy: req.user?.id
      })

      try {
        const {
          postOrderJournal,
          postOrderCogsJournal
        } = require('../service/accountingService')
        await postOrderJournal({
          store,
          orderId: order.id,
          orderNumber,
          subTotal,
          discountAmount,
          taxAmount,
          serviceChargeAmount: 0,
          totalPrice,
          date: new Date(),
          paymentMethod,
          createdBy: req.user?.id
        })
        await postOrderCogsJournal({
          store,
          orderId: order.id,
          orderNumber,
          date: new Date(),
          createdBy: req.user?.id
        })
      } catch (e) {
        console.error('Accounting posting skipped:', e.message)
      }
    }

    // Record promo usage
    if (appliedCampaignId) {
      try {
        const campaign = await db.promo_campaign.findByPk(appliedCampaignId)
        if (campaign) {
          await db.promo_usage.create({
            store: campaign.store,
            campaignId: appliedCampaignId,
            orderId: order.id,
            memberId: member ? member.id : null,
            discountApplied: discountAmount,
            freeItemsGiven: campaignResult.reward
              ? [
                  {
                    productId: campaignResult.reward.productId,
                    quantity: campaignResult.reward.quantity
                  }
                ]
              : null,
            appliedAt: new Date(),
            createdBy: req.user?.id
          })
          await campaign.update({
            currentUsage: (campaign.currentUsage || 0) + 1
          })
        }
      } catch (e) {
        console.error('Promo usage recording error:', e.message)
      }
    }

    if (member) {
      try {
        const productIds = [...new Set(items.map((i) => i.productId))]
        const products = await Product.findAll({
          where: { id: productIds },
          attributes: ['id', 'point']
        })
        const pointMap = Object.fromEntries(
          products.map((p) => [p.id, Number(p.point) || 0])
        )
        const pointsEarned = items.reduce((sum, item) => {
          return sum + (pointMap[item.productId] || 0) * Number(item.quantity)
        }, 0)

        if (pointsEarned > 0) {
          const oldTotal = Number(member.totalPoints) || 0
          const oldLifetime = Number(member.lifetimePoints) || 0
          await member.update({
            totalPoints: oldTotal + pointsEarned,
            lifetimePoints: oldLifetime + pointsEarned
          })
          let targetTier = await db.member_tier.findOne({
            where: {
              status: 'active',
              minPoints: { [Op.lte]: oldTotal + pointsEarned },
              maxPoints: { [Op.gte]: oldTotal + pointsEarned }
            },
            order: [['minPoints', 'DESC']]
          })
          if (!targetTier) {
            targetTier = await db.member_tier.findOne({
              where: {
                status: 'active',
                minPoints: { [Op.lte]: oldTotal + pointsEarned }
              },
              order: [['minPoints', 'DESC']]
            })
          }
          if (targetTier) {
            const currentMin = Number(
              (await db.member_tier.findByPk(member.tier))?.minPoints || -1
            )
            if (Number(targetTier.minPoints) > currentMin) {
              await member.update({ tier: targetTier.id })
            }
          }
          await db.member_point_history.create({
            member: member.id,
            pointsChange: pointsEarned,
            pointsBefore: oldTotal,
            pointsAfter: oldTotal + pointsEarned,
            transactionId: order.id,
            notes: `Earned ${pointsEarned} points from order ${orderNumber}`
          })
        }
      } catch (e) {
        console.error('Point earning error:', e.message)
      }
    }

    const fullOrder = await db.order.findOne({
      where: { id: order.id },
      include: [
        { model: db.order_item, as: 'items' },
        { model: db.table, as: 'table' }
      ]
    })

    createNotification({
      type: 'order_created',
      store,
      referenceId: order.id,
      referenceType: 'order',
      params: [orderNumber],
      createdBy: customerName || 'Customer'
    }).catch(console.error)

    emitNewOrder(store, fullOrder)

    return res.status(201).json({
      message: 'Order created',
      data: fullOrder
    })
  } catch (error) {
    // Two requests with the same idempotencyKey can both pass the earlier
    // findOne check and both attempt to create — the unique index on
    // (store, idempotencyKey) lets exactly one succeed; return the
    // winner's order to the loser instead of a raw 500.
    if (error.name === 'SequelizeUniqueConstraintError' && idempotencyKey) {
      const existingOrder = await Order.findOne({ where: { store, idempotencyKey } })
      if (existingOrder) {
        const fullOrder = await fetchFullOrder(existingOrder.id)
        return res.status(200).json({
          message: 'Order already exists for this idempotency key',
          data: fullOrder
        })
      }
    }
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

// ——— Public customer member lookup by name ———
exports.getCustomerMember = async (req, res) => {
  const { name, store } = req.query
  try {
    if (!name || !store) {
      return res.status(200).json({ data: null })
    }
    const Op = require('sequelize').Op
    const member = await db.member.findOne({
      where: {
        name: { [Op.iLike]: name.trim() },
        [Op.or]: [{ store: Number(store) }, { store: null }],
        status: 'active'
      }
    })
    if (!member) return res.status(200).json({ data: null })

    let tier = null
    if (member.tier) {
      const t = await db.member_tier.findByPk(member.tier)
      if (t) {
        tier = { id: t.id, name: t.name, discountPercent: t.discountPercent }
      }
    }

    return res.status(200).json({
      data: {
        id: member.id,
        name: member.name,
        totalPoints: member.totalPoints,
        tier
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

// ——— Public order tracking (no auth) ———
exports.getCustomerOrder = async (req, res) => {
  const { id } = req.params
  try {
    const order = await db.order.findOne({
      where: { id },
      attributes: [
        'id',
        'orderNumber',
        'status',
        'totalPrice',
        'totalQuantity',
        'customerName',
        'createdAt',
        'tableId',
        'paymentMethod',
        'paymentStatus',
        'splitCount'
      ],
      include: [
        {
          model: db.order_item,
          as: 'items',
          attributes: [
            'id',
            'productName',
            'quantity',
            'price',
            'totalPrice',
            'status'
          ]
        },
        { model: db.table, as: 'table', attributes: ['name'] }
      ]
    })
    if (!order) return res.status(404).json({ message: 'Order not found' })
    return res.status(200).json({ data: order })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

// ——— Public customer review (no auth) ———
exports.createCustomerReview = async (req, res) => {
  const { name, userName, productId, store, storeId, rating, comment, orderId } =
    req.body
  try {
    if (!productId || !rating) {
      return res
        .status(400)
        .json({ success: false, message: 'productId and rating are required' })
    }
    const product = await Product.findByPk(Number(productId))
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }
    const ratingNum = Number(rating)
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'rating must be an integer between 1 and 5'
      })
    }
    const reviewName = (name || userName || 'Anonim')
      .toString()
      .trim()
      .slice(0, 100)
    const storeNum = Number(store ?? storeId) || null
    const review = await db.product_review.create({
      productId: Number(productId),
      store: storeNum,
      userName: reviewName,
      rating: ratingNum,
      comment: (comment || '').toString().trim(),
      orderId: orderId ? Number(orderId) : null,
      status: 'published'
    })
    return res.status(201).json({
      success: true,
      message: 'Review submitted',
      data: review
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ success: false, error: 'Internal Server Error' })
  }
}

exports.getProductReviews = async (req, res) => {
  const { productId, store } = req.query
  try {
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: 'productId is required' })
    }
    const where = { productId: Number(productId), status: 'published' }
    if (store) where.store = Number(store)
    const reviews = await db.product_review.findAll({
      where,
      order: [['createdAt', 'DESC']]
    })
    const totalReviews = reviews.length
    const averageRating = totalReviews
      ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / totalReviews
      : 0
    return res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        productId: String(productId),
        reviews,
        averageRating: Number(averageRating.toFixed(1)),
        totalReviews
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ success: false, error: 'Internal Server Error' })
  }
}

// ——— Public customer order list (no auth) ———
exports.getCustomerOrders = async (req, res) => {
  const { store, tableId, session, page = 1, limit = 20 } = req.query
  try {
    if (!store) {
      return res.status(400).json({ message: 'store is required' })
    }
    const storeId = Number(store)
    if (isNaN(storeId)) {
      return res.status(400).json({ message: 'Invalid store value' })
    }

    const where = { store: storeId, source: 'qr' }
    if (tableId) where.tableId = Number(tableId)
    if (session && (await hasOrderColumn('session'))) {
      where.session = session
    }

    const offset = (Number(page) - 1) * Number(limit)

    const { count, rows } = await db.order.findAndCountAll({
      where,
      attributes: [
        'id',
        'orderNumber',
        'status',
        'subTotal',
        'discountAmount',
        'taxRate',
        'taxAmount',
        'serviceChargeAmount',
        'totalPrice',
        'totalQuantity',
        'customerName',
        'paymentMethod',
        'paymentStatus',
        'notes',
        'source',
        'session',
        'createdAt',
        'tableId',
        'splitCount'
      ],
      include: [
        {
          model: db.order_item,
          as: 'items',
          attributes: [
            'id',
            'productName',
            'quantity',
            'price',
            'totalPrice',
            'notes',
            'options',
            'modifiers',
            'status'
          ]
        },
        { model: db.table, as: 'table', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: rows,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit))
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

exports.getReceiptHTML = async (req, res) => {
  const { id } = req.params

  try {
    const printAttrs = await getOrderAttributes()
    const order = await db.order.findByPk(id, {
      include: [
        { model: db.order_item, as: 'items' },
        { model: db.table, as: 'table' }
      ],
      ...(printAttrs ? { attributes: printAttrs } : {})
    })

    if (!order) {
      return res.status(404).send('<h1>Order not found</h1>')
    }

    const storeData = order.store
      ? await db.location.findByPk(order.store, {
          attributes: [
            'name',
            'address',
            'detailLocation',
            'city',
            'province',
            'district',
            'village',
            'postalCode',
            'phoneNumber',
            'email'
          ]
        })
      : null

    const setting = order.store
      ? await db.invoice_setting.findOne({ where: { store: order.store } })
      : null

    const showLogo = setting?.showLogo !== false
    const showStoreName = setting?.showStoreName !== false
    const showAddress = setting?.showAddress !== false
    const logoUrl = setting?.logo || null
    const footerText = setting?.footer || 'Terima kasih atas kunjungan Anda'

    const addressFieldsVisibility = setting?.addressFieldsVisibility
      ? typeof setting.addressFieldsVisibility === 'string'
        ? JSON.parse(setting.addressFieldsVisibility)
        : setting.addressFieldsVisibility
      : {}

    const formatPrice = (v) => 'Rp' + Number(v || 0).toLocaleString('id-ID')

    const date = new Date(order.createdAt).toLocaleString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const itemsHtml = (order.items || [])
      .map(
        (item, i) => `
      <tr>
        <td style="padding:6px 4px;border-bottom:1px dashed #ccc">${i + 1}. ${item.productName || '-'}</td>
        <td style="text-align:center;padding:6px 4px;border-bottom:1px dashed #ccc">${item.quantity}</td>
        <td style="text-align:right;padding:6px 4px;border-bottom:1px dashed #ccc">${formatPrice(item.price)}</td>
        <td style="text-align:right;padding:6px 4px;border-bottom:1px dashed #ccc">${formatPrice(item.totalPrice)}</td>
      </tr>`
      )
      .join('')

    const STATUS_LABELS = {
      paid: 'LUNAS',
      unpaid: 'BELUM DIBAYAR',
      partial: 'DP'
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice - ${order.orderNumber}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 13px; margin: 0; padding: 20px; color: #000; }
    .receipt { max-width: 380px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
    .header h2 { margin: 4px 0; text-transform: uppercase; font-size: 16px; }
    .header p { margin: 2px 0; font-size: 11px; color: #555; }
    .info { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; font-size: 11px; }
    .info div { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; padding: 4px; }
    th.right { text-align: right; }
    th.center { text-align: center; }
    .totals { border-top: 1px dashed #000; padding-top: 8px; margin-top: 4px; font-size: 12px; }
    .totals > div { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals .grand-total { font-weight: bold; font-size: 15px; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
    .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #888; border-top: 1px dashed #ccc; padding-top: 12px; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
    .status-paid { background: #d4edda; color: #155724; }
    .status-unpaid { background: #fff3cd; color: #856404; }
      @media print { body { padding: 0; background: #fff; } .no-print { display: none; } }
      @media print { body { padding: 0; background: #fff; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="receipt" style="max-width: 380px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
    <div class="header" style="background: linear-gradient(135deg, #1f2937 0%, #111827 100%); color: #fff; padding: 20px; text-align: center;">
      ${showLogo && logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:60px; margin-bottom:8px;" />` : ''}
      ${showStoreName ? `<h2 style="margin:4px 0; text-transform:uppercase; font-size:16px; font-weight:bold;">${storeData?.name || 'TOKO'}</h2>` : ''}
      ${
        showAddress && storeData
          ? `
        <p style="margin:2px 0; font-size:11px; color:#9ca3af;">${storeData.name || ''}</p>
        <p style="margin:2px 0; font-size:11px; color:#9ca3af;">${storeData.address || ''}</p>
        ${storeData.detailLocation ? `<p style="margin:2px 0; font-size:11px; color:#9ca3af;">${storeData.detailLocation}</p>` : ''}
        ${
          [
            addressFieldsVisibility.province !== false
              ? storeData.province
              : null,
            addressFieldsVisibility.city !== false ? storeData.city : null,
            addressFieldsVisibility.district !== false
              ? storeData.district
              : null,
            addressFieldsVisibility.village !== false ? storeData.village : null
          ].filter(Boolean).length > 0
            ? `<p style="margin:2px 0; font-size:11px; color:#9ca3af;">${[
                addressFieldsVisibility.province !== false
                  ? storeData.province
                  : null,
                addressFieldsVisibility.city !== false ? storeData.city : null,
                addressFieldsVisibility.district !== false
                  ? storeData.district
                  : null,
                addressFieldsVisibility.village !== false
                  ? storeData.village
                  : null
              ]
                .filter(Boolean)
                .join(', ')}</p>`
            : ''
        }
        ${addressFieldsVisibility.postalCode !== false && storeData.postalCode ? `<p style="margin:2px 0; font-size:11px; color:#9ca3af;">Kode Pos: ${storeData.postalCode}</p>` : ''}
        ${addressFieldsVisibility.phone !== false && storeData.phoneNumber ? `<p style="margin:2px 0; font-size:11px; color:#9ca3af;">Telp: ${storeData.phoneNumber}</p>` : ''}
        ${addressFieldsVisibility.email !== false && storeData.email ? `<p style="margin:2px 0; font-size:11px; color:#9ca3af;">${storeData.email}</p>` : ''}
      `
          : ''
      }
    </div>

    <div class="meta" style="display:flex; justify-content:space-between; padding:10px 16px; border-bottom:1px solid #eee; font-size:11px;">
      <div>
        <span class="label" style="color:#9ca3af; font-size:9px; font-weight:600;">Invoice</span>
        <strong>${order.orderNumber}</strong>
      </div>
      <div style="text-align: right;">
        <span class="label" style="color:#9ca3af; font-size:9px; font-weight:600;">${date}</span>
      </div>
    </div>

    <div class="member-info" style="display:flex; justify-content:space-between; padding:8px 16px; border-bottom:1px dashed #ccc; font-size:11px;">
      <div><span class="label" style="color:#9ca3af; font-size:9px; font-weight:600;">Kasir</span><span> ${order.cashierName || '-'}</span></div>
      ${order.customerName ? `<div><span class="label" style="color:#9ca3af; font-size:9px; font-weight:600;">Pelanggan</span><span> ${order.customerName}</span></div>` : ''}
      ${order.table?.name ? `<div><span class="label" style="color:#9ca3af; font-size:9px; font-weight:600;">Meja</span><span> ${order.table.name}</span></div>` : ''}
      <div style="margin-top:4px">
        <span class="status-badge ${order.paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}" style="${order.paymentStatus === 'paid' ? 'background:#d4edda;color:#155724;' : 'background:#fff3cd;color:#856404;'} display:inline-block; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:bold;">
          ${STATUS_LABELS[order.paymentStatus] || order.paymentStatus || 'BELUM DIBAYAR'}
        </span>
      </div>
    </div>

    <div class="table-container" style="padding:0 16px;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #d1d5db;">
            <th style="text-align:left; font-size:10px; text-transform:uppercase; padding:8px 4px; color:#6b7280; font-weight:600;">Item</th><th class="center" style="text-align:center; font-size:10px; text-transform:uppercase; padding:8px 4px; color:#6b7280; font-weight:600; width:30px;">Qty</th><th class="right" style="text-align:right; font-size:10px; text-transform:uppercase; padding:8px 4px; color:#6b7280; font-weight:600;">Harga</th><th class="right" style="text-align:right; font-size:10px; text-transform:uppercase; padding:8px 4px; color:#6b7280; font-weight:600;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>

    <div class="totals" style="padding:12px 16px;">
      <div class="summary" style="background:#f9fafb; border-radius:8px; padding:12px;">
        ${order.subTotal !== undefined ? `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px;"><span>Subtotal</span><span>${formatPrice(order.subTotal)}</span></div>` : ''}
        ${order.discountAmount > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px;"><span>Diskon</span><span style="color:#c00">-${formatPrice(order.discountAmount)}</span></div>` : ''}
        ${order.serviceChargeAmount > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px;"><span>Biaya Layanan</span><span>${formatPrice(order.serviceChargeAmount)}</span></div>` : ''}
        ${order.taxAmount > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px;"><span>Pajak</span><span>${formatPrice(order.taxAmount)}</span></div>` : ''}
        <div class="grand-total" style="font-weight:bold; font-size:14px; border-top:1px solid #d1d5db; padding-top:8px; margin-top:4px; display:flex; justify-content:space-between;"><span>TOTAL</span><span>${formatPrice(order.totalPrice)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px;"><span>${order.paymentMethod || '-'}</span><span>${formatPrice(order.totalPrice)}</span></div>
      </div>
    </div>

    <div class="footer" style="padding:16px; text-align:center; font-size:11px; color:#9ca3af; border-top:1px dashed #e5e7eb;">
      <p class="footer-it" style="font-style:italic; margin:0 0 8px 0;">${footerText}</p>
      <div class="social" style="display:flex; justify-content:center; gap:12px; margin-top:8px; padding-top:8px; border-top:1px dashed #e5e7eb; font-size:10px; color:#9ca3af;">
        ${
          storeData?.socialMedia
            ? Object.entries(storeData.socialMedia)
                .map(
                  ([platform, _url]) =>
                    `<img src="/icon/${platform}.svg" alt="${platform}" style="height:16px;width:auto;" />`
                )
                .join('')
            : ''
        }
      </div>
    </div>

    <div class="no-print" style="text-align:center;margin-top:20px">
      <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff">
        Cetak / Simpan PDF
      </button>
      <p style="font-size:11px;color:#999;margin-top:6px">Tekan tombol di atas, lalu pilih "Save as PDF"</p>
    </div>
  </div>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch (error) {
    console.error('Error generating receipt:', error)
    return res.status(500).send('<h1>Internal Server Error</h1>')
  }
}

exports.getCustomerTaxRate = async (req, res) => {
  const { store } = req.query
  if (!store) {
    return res.status(400).json({ message: 'store is required' })
  }
  try {
    const rate = await getActiveTaxRate(Number(store))
    const serviceChargeRate = await getServiceChargeRate(Number(store))
    return res.status(200).json({ data: { rate, serviceChargeRate } })
  } catch (error) {
    console.error('Error fetching customer tax rate:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
