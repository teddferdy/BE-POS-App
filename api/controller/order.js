const db = require('../../db/models')
const Order = db.order
const OrderItem = db.order_item
const OrderStatus = db.order_status
const Table = db.table
const Product = db.product
const Discount = db.discount
const Transaction = db.transaction
const BestSelling = db.best_selling
const { Op } = require('sequelize')
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')
const { emitItemStatusUpdate, emitNewOrder } = require('../service/socket')

const generateOrderNumber = () => {
  const date = new Date()
  const timestamp = date.getTime().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD${timestamp}${random}`
}

const getActiveTaxRate = async (store) => {
  try {
    const taxConfigs = await db.taxConfig.findAll({
      where: { store, status: 'active' },
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
  // Could be extended to a service_charge_config table
  return 5
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

exports.createOrder = async (req, res) => {
  const {
    store,
    tableId,
    cashierId,
    cashierName,
    items,
    discountId,
    discountAmount,
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
    redeemedPoints
  } = req.body

  try {
    const orderNumber = generateOrderNumber()

    if (tableId) {
      const table = await Table.findOne({ where: { id: tableId, store } })
      if (table) {
        if (table.status === 'occupied') {
          return res.status(400).json({
            message: 'Table is already occupied'
          })
        }
        await table.update({ status: 'occupied' })
      }
    }

    let discountValue = 0
    let discountType = 'none'
    let appliedDiscountId = null
    let appliedDiscountMeta = null

    // Priority 1: Explicit discountId (from dropdown)
    if (discountId) {
      const discount = await Discount.findOne({
        where: { id: discountId, store }
      })
      if (discount) {
        discountValue = discount.value
        discountType = discount.type
        appliedDiscountId = discount.id
        appliedDiscountMeta = discount
      }
    }

    // Priority 2: Promo code
    if (promoCode && !appliedDiscountId) {
      const promoDiscount = await Discount.findOne({
        where: { code: promoCode.trim().toUpperCase(), store, status: 'active' }
      })
      if (promoDiscount) {
        const now = new Date()
        if (
          !promoDiscount.startDate ||
          new Date(promoDiscount.startDate) <= now
        ) {
          if (
            !promoDiscount.endDate ||
            new Date(promoDiscount.endDate) >= now
          ) {
            discountValue = promoDiscount.value
            discountType = promoDiscount.type
            appliedDiscountId = promoDiscount.id
            appliedDiscountMeta = promoDiscount
          }
        }
      }
    }

    // Priority 3: Member tier auto-discount
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

    // Priority 4: Redeem points
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

    // ponytail: snapshot original subtotals for per-item discountAmount tracking
    items.forEach((item) => {
      item._origSubtotal = item.subtotal
    })

    // Pre-load bundles for stock validation
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
        if (!bundle) {
          return res.status(400).json({
            message: `Bundle not found: ${item.bundleName || item.bundleId}`
          })
        }
        if (!bundle.isAvailable || bundle.status !== 'active') {
          return res.status(400).json({
            message: `Bundle "${bundle.name}" is not available`
          })
        }
        bundleMap[item.bundleId] = bundle
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
            return res.status(400).json({
              message: `Product in bundle "${bundle.name}" not found`
            })
          }
          const needed = bi.quantity * bundleQty
          if (prod.stock !== null && Number(prod.stock) < needed) {
            return res.status(400).json({
              message: `Stok "${prod.nameProduct}" tidak mencukupi untuk bundle "${bundle.name}". Tersedia: ${prod.stock}, dibutuhkan: ${needed}`
            })
          }
        }
      }
    }

    const taxRate = await getActiveTaxRate(store)
    const serviceChargeRate = await getServiceChargeRate(store)

    let totals
    let promoDiscountAmount = 0
    let appliedCampaignId = null

    // Priority 5: Evaluate promo campaigns (replaces old applyAdvancedPromo)
    const campaignResult = await evaluatePromoCampaign(
      items.map((item) => ({
        ...item,
        productId: item.product || item.productId,
        unitPrice: item.unitPrice ?? item.price ?? item.basePrice ?? 0
      })),
      store,
      customerId,
      0 // initial subtotal before discount
    )

    // Calculate subtotal first for campaign evaluation
    let rawSubTotal = 0
    items.forEach((item) => {
      rawSubTotal += item.subtotal
    })

    // Re-evaluate campaign with actual subtotal
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

    // Use campaign discount if no manual discount applied and campaign gives a better deal
    if (!appliedDiscountId && campaignWithSubtotal.discountAmount > 0) {
      promoDiscountAmount = campaignWithSubtotal.discountAmount
      appliedCampaignId = campaignWithSubtotal.campaignId
      totals = calculateOrderTotals(
        items,
        0,
        'none',
        taxRate,
        serviceChargeRate
      )
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
      totals = calculateOrderTotals(
        items,
        0,
        'none',
        taxRate,
        serviceChargeRate
      )
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

    // Stock validation — products (non-bundle items)
    for (const item of items) {
      if (item.bundleId) continue
      const prod = await Product.findByPk(item.product || item.productId)
      if (!prod) {
        return res.status(400).json({
          message: `Product not found: ${item.productName || item.product || item.productId}`
        })
      }
      if (prod.stock !== null && Number(prod.stock) < Number(item.quantity)) {
        return res.status(400).json({
          message: `Stok "${prod.nameProduct}" tidak mencukupi. Tersedia: ${prod.stock}, diminta: ${item.quantity}`
        })
      }
    }

    // Stock validation — ingredients via BOM (non-bundle items)
    for (const item of items) {
      if (item.bundleId) continue
      const bom = await db.bom_header.findOne({
        where: { productId: item.product || item.productId, status: 'active' },
        include: [{ model: db.bom_line, as: 'lines' }]
      })
      if (!bom) continue
      for (const line of bom.lines) {
        const ing = await db.ingredient.findByPk(line.ingredientId)
        if (!ing) continue
        const needed = line.qty * Number(item.quantity)
        if (Number(ing.stock) < needed) {
          return res.status(400).json({
            message: `Stok bahan "${ing.name}" tidak mencukupi untuk "${item.productName}". Tersedia: ${ing.stock}, dibutuhkan: ${needed}`
          })
        }
      }
    }

    const order = await Order.create({
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
      promoCampaignId: appliedCampaignId,
      taxRate,
      taxAmount: totals.taxAmount,
      serviceChargeRate,
      serviceChargeAmount: totals.serviceChargeAmount,
      totalPrice: totals.totalPrice,
      currencyId: currencyId || null,
      currencyCode: currencyCode || null,
      exchangeRate: exchangeRate || null,
      createdBy: req.user?.id
    })

    // Create order items
    for (const item of items) {
      if (item.bundleId && bundleMap[item.bundleId]) {
        // Bundle item: create one order_item for the bundle
        const bundle = bundleMap[item.bundleId]
        const itemDiscountAmount = Math.max(
          0,
          (item._origSubtotal || 0) - (item.subtotal || 0)
        )
        await OrderItem.create({
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
          status: 'pending'
        })
      } else {
        // Regular product item
        const product = await Product.findByPk(item.product || item.productId)
        const costPrice = product
          ? Number(product.costPrice || product.price || 0)
          : 0
        const itemDiscountAmount = Math.max(
          0,
          (item._origSubtotal || 0) - (item.subtotal || 0)
        )
        await OrderItem.create({
          order: order.id,
          product: item.product || item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.basePrice || item.price,
          discountType,
          discountValue,
          discountAmount: itemDiscountAmount,
          totalPrice: item.subtotal || item.totalPrice,
          options: item.options || [],
          modifiers: item.modifiers || [],
          notes: item.notes,
          hppSnapshot: costPrice,
          status: 'pending'
        })
      }
    }

    // Reduce stock & create stock history — wrapped in transaction for atomicity
    await db.sequelize.transaction(async (t) => {
      for (const item of items) {
        if (item.bundleId && bundleMap[item.bundleId]) {
          // Bundle: deduct stock for each component product
          const bundle = bundleMap[item.bundleId]
          const bundleQty = Number(item.quantity) || 1
          for (const bi of bundle.items) {
            const product = await Product.findByPk(bi.product, {
              transaction: t
            })
            if (!product) continue
            const deductQty = bi.quantity * bundleQty
            const oldStock = Number(product.stock) || 0
            const newStock = Math.max(oldStock - deductQty, 0)
            await product.update(
              {
                stock: db.sequelize.literal(`GREATEST(stock - ${deductQty}, 0)`)
              },
              { transaction: t }
            )

            await db.sequelize.query(
              `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
               VALUES ($1, $2, 0, NOW(), NOW())
               ON CONFLICT (product, store) DO NOTHING`,
              { bind: [product.id, store], transaction: t }
            )
            await db.product_store_stock.update(
              {
                stock: db.sequelize.literal(`GREATEST(stock - ${deductQty}, 0)`)
              },
              { where: { product: product.id, store }, transaction: t }
            )

            await db.stock_history.create(
              {
                product: product.id,
                store,
                referenceType: 'sale',
                referenceId: order.id,
                quantityBefore: oldStock,
                quantityChange: -deductQty,
                quantityAfter: newStock >= 0 ? newStock : 0,
                unit: product.unit || 'pcs',
                notes: `Penjualan bundle: ${bundle.name} (${orderNumber})`,
                createdBy: req.user?.id
              },
              { transaction: t }
            )

            // BOM ingredient deduction for bundle components
            const bom = await db.bom_header.findOne({
              where: { productId: product.id, status: 'active' },
              include: [{ model: db.bom_line, as: 'lines' }],
              transaction: t
            })
            if (bom) {
              for (const line of bom.lines) {
                const ing = await db.ingredient.findByPk(line.ingredientId, {
                  transaction: t
                })
                if (!ing) continue
                const ingDeductQty = line.qty * deductQty
                const oldIngStock = Number(ing.stock)
                const ingNewStock = Math.max(oldIngStock - ingDeductQty, 0)
                await ing.update(
                  {
                    stock: db.sequelize.literal(
                      `GREATEST(stock - ${ingDeductQty}, 0)`
                    )
                  },
                  { transaction: t }
                )
                await db.stock_history.create(
                  {
                    product: product.id,
                    ingredient: ing.id,
                    ingredientName: ing.name,
                    store,
                    referenceType: 'sale',
                    referenceId: order.id,
                    quantityBefore: oldIngStock,
                    quantityChange: -(oldIngStock - ingNewStock),
                    quantityAfter: ingNewStock,
                    unit: line.unit || ing.unit,
                    createdBy: req.user?.id
                  },
                  { transaction: t }
                )
              }
            }

            // Best-selling tracking for bundle components
            const findBs = await db.best_selling.findOne({
              where: {
                productId: product.id,
                nameProduct: product.nameProduct,
                store
              },
              transaction: t
            })
            if (findBs) {
              await db.best_selling.update(
                { totalSelling: Number(findBs.totalSelling) + deductQty },
                {
                  where: {
                    productId: product.id,
                    nameProduct: product.nameProduct
                  },
                  transaction: t
                }
              )
            } else {
              await db.best_selling.create(
                {
                  productId: product.id,
                  nameProduct: product.nameProduct,
                  image: product.image || null,
                  totalSelling: deductQty,
                  store
                },
                { transaction: t }
              )
            }
          }
          continue
        }

        // Regular product item
        const product = await Product.findByPk(item.product || item.productId, {
          transaction: t
        })
        if (!product) continue

        const bom = await db.bom_header.findOne({
          where: {
            productId: item.product || item.productId,
            status: 'active'
          },
          include: [{ model: db.bom_line, as: 'lines' }],
          transaction: t
        })

        if (!bom) {
          const oldStock = Number(product.stock) || 0
          const qty = Math.floor(Number(item.quantity)) || 0
          const newStock = Math.max(oldStock - qty, 0)
          await product.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
            { transaction: t }
          )

          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [product.id, store], transaction: t }
          )
          await db.product_store_stock.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
            { where: { product: product.id, store }, transaction: t }
          )

          await db.stock_history.create(
            {
              product: product.id,
              store,
              referenceType: 'sale',
              referenceId: order.id,
              quantityBefore: oldStock,
              quantityChange: -Number(item.quantity),
              quantityAfter: newStock >= 0 ? newStock : 0,
              unit: product.unit || 'pcs',
              notes: `Penjualan: ${orderNumber}`,
              createdBy: req.user?.id
            },
            { transaction: t }
          )
        }

        const findBs = await db.best_selling.findOne({
          where: {
            productId: product.id,
            nameProduct: item.productName,
            store
          },
          transaction: t
        })
        if (findBs) {
          await db.best_selling.update(
            {
              totalSelling: Number(findBs.totalSelling) + Number(item.quantity)
            },
            {
              where: { productId: product.id, nameProduct: item.productName },
              transaction: t
            }
          )
        } else {
          await db.best_selling.create(
            {
              productId: product.id,
              nameProduct: item.productName,
              image: product.image || null,
              totalSelling: Number(item.quantity),
              store
            },
            { transaction: t }
          )
        }

        if (bom) {
          for (const line of bom.lines) {
            const ing = await db.ingredient.findByPk(line.ingredientId, {
              transaction: t
            })
            if (!ing) continue
            const deductQty = line.qty * Number(item.quantity)
            const oldIngStock = Number(ing.stock)
            const qty = Math.floor(Number(deductQty)) || 0
            const newIngStock = Math.max(oldIngStock - qty, 0)
            await ing.update(
              { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
              { transaction: t }
            )
            await db.stock_history.create(
              {
                product: product.id,
                ingredient: ing.id,
                ingredientName: ing.name,
                store,
                referenceType: 'sale',
                referenceId: order.id,
                quantityBefore: oldIngStock,
                quantityChange: -(oldIngStock - newIngStock),
                quantityAfter: newIngStock,
                unit: line.unit || ing.unit,
                createdBy: req.user?.id
              },
              { transaction: t }
            )
          }
        }
      }
    })

    // Create transaction record
    if (paymentMethod) {
      await db.transaction.create({
        order: order.id,
        typePayment: paymentMethod,
        amount: totals.totalPrice,
        createdBy: req.user?.id
      })
    }

    await OrderStatus.create({
      order: order.id,
      status: 'paid',
      createdBy: req.user?.id,
      notes: `Paid by ${cashierName} via ${paymentMethod || 'cash'}`
    })

    // Deduct redeemed points from member
    if (redeemedPointsUsed > 0 && customerId) {
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

    // Award points earned from product point values
    if (customerId) {
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
              createdBy: req.user?.id
            })
          }
        }
      } catch (e) {
        console.error('Point earning error:', e.message)
      }
    }

    // Record promo campaign usage
    if (appliedCampaignId) {
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

    return res.status(201).json({
      message: 'Order created successfully',
      data: fullOrder
    })
  } catch (error) {
    console.error('Error creating order:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getOrdersByStore = async (req, res) => {
  const { store, status, date, table, startDate, endDate, page, limit } =
    req.query

  try {
    const where = {}
    if (store) where.store = store
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

    const { count: total, rows: orders } = await Order.findAndCountAll({
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
    })

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
    const order = await Order.findOne({
      where: { id },
      include: [
        { model: OrderItem, as: 'items' },
        { model: OrderStatus, as: 'statusHistory' },
        { model: Table, as: 'table' }
      ]
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
  const { id, store, status, changedBy, changedByName, notes } = req.body

  try {
    const order = await Order.findOne({ where: { id, store } })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    const oldStatus = order.status

    await order.update({ status })

    await OrderStatus.create({
      order: id,
      status,
      createdBy: changedBy,
      notes: notes || (changedByName ? `By ${changedByName}` : null)
    })

    // If transitioning to paid, reduce stock
    if (status === 'paid' && oldStatus !== 'paid') {
      const items = await OrderItem.findAll({ where: { order: id } })

      for (const item of items) {
        const product = await Product.findByPk(item.product)
        if (!product) continue

        const bom = await db.bom_header.findOne({
          where: { productId: item.product, status: 'active' },
          include: [{ model: db.bom_line, as: 'lines' }]
        })

        if (!bom) {
          const oldStock = Number(product.stock) || 0
          const qty = Math.floor(Number(item.quantity)) || 0
          const newStock = Math.max(oldStock - qty, 0)
          await product.update({
            stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`)
          })

          // ponytail: atomic upsert + deduct per-store stock
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [item.product, store] }
          )
          await db.product_store_stock.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
            { where: { product: item.product, store } }
          )

          await db.stock_history.create({
            product: product.id,
            store,
            referenceType: 'sale',
            referenceId: order.id,
            quantityBefore: oldStock,
            quantityChange: -Number(item.quantity),
            quantityAfter: newStock,
            unit: product.unit || 'pcs',
            notes: `Penjualan: ${order.orderNumber}`,
            createdBy: changedBy
          })
        }

        const findBs = await db.best_selling.findOne({
          where: { productId: product.id, nameProduct: item.productName, store }
        })
        if (findBs) {
          await db.best_selling.update(
            {
              totalSelling: Number(findBs.totalSelling) + Number(item.quantity)
            },
            { where: { productId: product.id, nameProduct: item.productName } }
          )
        } else {
          await db.best_selling.create({
            productId: product.id,
            nameProduct: item.productName,
            image: product.image || null,
            totalSelling: Number(item.quantity),
            store
          })
        }

        if (bom) {
          for (const line of bom.lines) {
            const ing = await db.ingredient.findByPk(line.ingredientId)
            if (!ing) continue
            const deductQty = line.qty * Number(item.quantity)
            const oldIngStock = Number(ing.stock)
            const qty = Math.floor(Number(deductQty)) || 0
            const newIngStock = Math.max(oldIngStock - qty, 0)
            await ing.update({
              stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`)
            })
            await db.stock_history.create({
              product: product.id,
              ingredient: ing.id,
              ingredientName: ing.name,
              store,
              referenceType: 'sale',
              referenceId: order.id,
              quantityBefore: oldIngStock,
              quantityChange: -(oldIngStock - newIngStock),
              quantityAfter: newIngStock,
              unit: line.unit || ing.unit,
              createdBy: changedBy
            })
          }
        }
      }
    }

    // If transitioning to cancelled/void, reverse stock
    if (
      ['cancelled', 'void'].includes(status) &&
      !['cancelled', 'void'].includes(oldStatus)
    ) {
      const items = await OrderItem.findAll({ where: { order: id } })

      for (const item of items) {
        const product = await Product.findByPk(item.product)
        if (!product) continue

        const bom = await db.bom_header.findOne({
          where: { productId: item.product, status: 'active' },
          include: [{ model: db.bom_line, as: 'lines' }]
        })

        if (!bom) {
          const oldStock = Number(product.stock) || 0
          const qty = Math.floor(Number(item.quantity)) || 0
          const newStock = oldStock + qty
          await product.update({
            stock: db.sequelize.literal(`stock + ${qty}`)
          })

          // ponytail: atomic restore per-store stock
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [item.product, store] }
          )
          await db.product_store_stock.update(
            { stock: db.sequelize.literal(`stock + ${qty}`) },
            { where: { product: item.product, store } }
          )

          await db.stock_history.create({
            product: product.id,
            store,
            referenceType: 'sale_reversal',
            referenceId: order.id,
            quantityBefore: oldStock,
            quantityChange: Number(item.quantity),
            quantityAfter: newStock,
            unit: product.unit || 'pcs',
            notes: `Pembatalan: ${order.orderNumber}`,
            createdBy: changedBy
          })
        }

        const findBs = await db.best_selling.findOne({
          where: { productId: product.id, nameProduct: item.productName, store }
        })
        if (findBs) {
          await db.best_selling.update(
            {
              totalSelling: Math.max(
                0,
                Number(findBs.totalSelling) - Number(item.quantity)
              )
            },
            { where: { productId: product.id, nameProduct: item.productName } }
          )
        }

        if (bom) {
          for (const line of bom.lines) {
            const ing = await db.ingredient.findByPk(line.ingredientId)
            if (!ing) continue
            const restoreQty = line.qty * Number(item.quantity)
            const oldIngStock = Number(ing.stock)
            const qty = Math.floor(Number(restoreQty)) || 0
            await ing.update({ stock: db.sequelize.literal(`stock + ${qty}`) })
            await db.stock_history.create({
              product: product.id,
              ingredient: ing.id,
              ingredientName: ing.name,
              store,
              referenceType: 'sale_reversal',
              referenceId: order.id,
              quantityBefore: oldIngStock,
              quantityChange: restoreQty,
              quantityAfter: oldIngStock + restoreQty,
              unit: line.unit || ing.unit,
              createdBy: changedBy
            })
          }
        }
      }
    }

    if (order.tableId && ['paid', 'cancelled', 'void'].includes(status)) {
      await Table.update(
        { status: 'available' },
        { where: { id: order.tableId } }
      )
    }

    createAudit(req, 'update', 'order', id, `Updated order status to ${status}`)

    return res.status(200).json({
      message: 'Order status updated',
      data: order
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
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

    const order = await Order.findByPk(id)
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
    const whereClause = store ? { store } : {}
    const orders = await Order.findAll({
      where: whereClause,
      include: [
        {
          model: OrderItem,
          as: 'items',
          where: {
            status: {
              [require('sequelize').Op.in]: ['pending', 'preparing', 'ready']
            }
          }
        }
      ],
      order: [['createdAt', 'DESC']]
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

    const products = await db.product.findAll({
      where: {
        [Op.or]: [
          { store: { [Op.contains]: [storeId] } },
          { store: null },
          db.sequelize.literal('"product"."store" = \'[]\'::jsonb')
        ],
        status: 'active'
      },
      include: [
        { model: db.category, as: 'categoryData', attributes: ['name'] }
      ],
      order: [
        ['categoryData', 'name', 'ASC'],
        ['nameProduct', 'ASC']
      ]
    })

    const categories = await db.category.findAll({
      where: {
        [Op.or]: [
          { store: { [Op.contains]: [storeId] } },
          { store: null },
          db.sequelize.literal('"category"."store" = \'[]\'::jsonb')
        ],
        status: 'active'
      },
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
  const { store, tableId, items, customerName, notes, customerId } = req.body

  try {
    if (!store || !items || !items.length) {
      return res.status(400).json({ message: 'store and items are required' })
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
        if (!bundle || !bundle.isAvailable || bundle.status !== 'active') {
          return res.status(400).json({
            message: `Bundle not available: ${item.bundleName || item.bundleId}`
          })
        }
        bundleMap[item.bundleId] = bundle
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
          if (prod.stock !== null && Number(prod.stock) < needed) {
            return res.status(400).json({
              message: `Stok "${prod.nameProduct}" tidak mencukupi untuk bundle "${bundle.name}". Tersedia: ${prod.stock}, dibutuhkan: ${needed}`
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
      if (prod.stock !== null && Number(prod.stock) < Number(item.quantity)) {
        return res.status(400).json({
          message: `Stok "${prod.nameProduct}" tidak mencukupi. Tersedia: ${prod.stock}, diminta: ${item.quantity}`
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
        orderItems.push({
          product: bundle.items[0]?.product || 0,
          productName: bundle.name,
          quantity: item.quantity,
          price: bundle.bundlePrice,
          bundleId: bundle.id,
          bundleName: bundle.name,
          totalPrice: subtotal,
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
          productName: item.productName,
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

    const order = await db.order.create({
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
      promoCampaignId: appliedCampaignId,
      taxRate,
      taxAmount,
      serviceChargeAmount: 0,
      totalPrice
    })

    for (const item of orderItems) {
      await db.order_item.create({ ...item, order: order.id })
    }

    // Deduct stock
    await db.sequelize.transaction(async (t) => {
      for (const item of items) {
        if (item.bundleId && bundleMap[item.bundleId]) {
          const bundle = bundleMap[item.bundleId]
          const bundleQty = Number(item.quantity) || 1
          for (const bi of bundle.items) {
            const product = await Product.findByPk(bi.product, {
              transaction: t
            })
            if (!product) continue
            const deductQty = bi.quantity * bundleQty
            const oldStock = Number(product.stock) || 0
            const newStock = Math.max(oldStock - deductQty, 0)
            await product.update(
              {
                stock: db.sequelize.literal(`GREATEST(stock - ${deductQty}, 0)`)
              },
              { transaction: t }
            )

            await db.sequelize.query(
              `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
               VALUES ($1, $2, 0, NOW(), NOW())
               ON CONFLICT (product, store) DO NOTHING`,
              { bind: [product.id, store], transaction: t }
            )
            await db.product_store_stock.update(
              {
                stock: db.sequelize.literal(`GREATEST(stock - ${deductQty}, 0)`)
              },
              { where: { product: product.id, store }, transaction: t }
            )

            await db.stock_history.create(
              {
                product: product.id,
                store,
                referenceType: 'sale',
                referenceId: order.id,
                quantityBefore: oldStock,
                quantityChange: -deductQty,
                quantityAfter: newStock >= 0 ? newStock : 0,
                unit: product.unit || 'pcs',
                notes: `Penjualan bundle: ${bundle.name} (${orderNumber})`,
                createdBy: req.user?.id
              },
              { transaction: t }
            )

            const bom = await db.bom_header.findOne({
              where: { productId: product.id, status: 'active' },
              include: [{ model: db.bom_line, as: 'lines' }],
              transaction: t
            })
            if (bom) {
              for (const line of bom.lines) {
                const ing = await db.ingredient.findByPk(line.ingredientId, {
                  transaction: t
                })
                if (!ing) continue
                const ingDeductQty = line.qty * deductQty
                const oldIngStock = Number(ing.stock)
                const ingNewStock = Math.max(oldIngStock - ingDeductQty, 0)
                await ing.update(
                  {
                    stock: db.sequelize.literal(
                      `GREATEST(stock - ${ingDeductQty}, 0)`
                    )
                  },
                  { transaction: t }
                )
                await db.stock_history.create(
                  {
                    product: product.id,
                    ingredient: ing.id,
                    ingredientName: ing.name,
                    store,
                    referenceType: 'sale',
                    referenceId: order.id,
                    quantityBefore: oldIngStock,
                    quantityChange: -(oldIngStock - ingNewStock),
                    quantityAfter: ingNewStock,
                    unit: line.unit || ing.unit,
                    createdBy: req.user?.id
                  },
                  { transaction: t }
                )
              }
            }
          }
          continue
        }

        const product = item.productId
          ? await Product.findByPk(item.productId, { transaction: t })
          : null
        if (!product) continue

        const bom = await db.bom_header.findOne({
          where: { productId: item.productId, status: 'active' },
          include: [{ model: db.bom_line, as: 'lines' }],
          transaction: t
        })

        if (!bom) {
          const oldStock = Number(product.stock) || 0
          const qty = Math.floor(Number(item.quantity)) || 0
          const newStock = Math.max(oldStock - qty, 0)
          await product.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
            { transaction: t }
          )

          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [product.id, store], transaction: t }
          )
          await db.product_store_stock.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
            { where: { product: product.id, store }, transaction: t }
          )

          await db.stock_history.create(
            {
              product: product.id,
              store,
              referenceType: 'sale',
              referenceId: order.id,
              quantityBefore: oldStock,
              quantityChange: -Number(item.quantity),
              quantityAfter: newStock >= 0 ? newStock : 0,
              unit: product.unit || 'pcs',
              notes: `Penjualan: ${orderNumber}`,
              createdBy: req.user?.id
            },
            { transaction: t }
          )
        }

        if (bom) {
          for (const line of bom.lines) {
            const ing = await db.ingredient.findByPk(line.ingredientId, {
              transaction: t
            })
            if (!ing) continue
            const deductQty = line.qty * Number(item.quantity)
            const oldIngStock = Number(ing.stock)
            const qty = Math.floor(Number(deductQty)) || 0
            const newIngStock = Math.max(oldIngStock - qty, 0)
            await ing.update(
              { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
              { transaction: t }
            )
            await db.stock_history.create(
              {
                product: product.id,
                ingredient: ing.id,
                ingredientName: ing.name,
                store,
                referenceType: 'sale',
                referenceId: order.id,
                quantityBefore: oldIngStock,
                quantityChange: -(oldIngStock - newIngStock),
                quantityAfter: newIngStock,
                unit: line.unit || ing.unit,
                createdBy: req.user?.id
              },
              { transaction: t }
            )
          }
        }
      }
    })

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

    if (table) {
      await table.update({ status: 'occupied' })
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
        'tableId'
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

exports.getReceiptHTML = async (req, res) => {
  const { id } = req.params

  try {
    const order = await db.order.findByPk(id, {
      include: [
        { model: db.order_item, as: 'items' },
        { model: db.table, as: 'table' }
      ]
    })

    if (!order) {
      return res.status(404).send('<h1>Order not found</h1>')
    }

    const storeData = order.store
      ? await db.location.findByPk(order.store, {
          attributes: ['name', 'address', 'phoneNumber']
        })
      : null

    const setting = order.store
      ? await db.invoice_setting.findOne({ where: { store: order.store } })
      : null

    const showLogo = setting?.showLogo !== false
    const showStoreName = setting?.showStoreName !== false
    const showAddress = setting?.showAddress !== false
    const logoUrl = setting?.logo || null

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
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      ${showLogo && logoUrl ? `<img src="${logoUrl}" style="max-height:50px;margin-bottom:6px" />` : ''}
      ${showStoreName ? `<h2>${storeData?.name || 'TOKO'}</h2>` : ''}
      ${showAddress && storeData ? `<p>${[storeData.address, storeData.phoneNumber].filter(Boolean).join(' | ')}</p>` : ''}
    </div>

    <div class="info">
      <div><span>Invoice</span><strong>${order.orderNumber}</strong></div>
      <div><span>Tanggal</span><span>${date}</span></div>
      <div><span>Kasir</span><span>${order.cashierName || '-'}</span></div>
      ${order.customerName ? `<div><span>Pelanggan</span><span>${order.customerName}</span></div>` : ''}
      ${order.table?.name ? `<div><span>Meja</span><span>${order.table.name}</span></div>` : ''}
      <div style="margin-top:4px">
        <span class="status-badge ${order.paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}">
          ${STATUS_LABELS[order.paymentStatus] || order.paymentStatus || 'BELUM DIBAYAR'}
        </span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th><th class="center">Qty</th><th class="right">Harga</th><th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><span>${formatPrice(order.subTotal)}</span></div>
      ${order.discountAmount > 0 ? `<div><span>Diskon</span><span style="color:#c00">-${formatPrice(order.discountAmount)}</span></div>` : ''}
      ${order.serviceChargeAmount > 0 ? `<div><span>Biaya Layanan</span><span>${formatPrice(order.serviceChargeAmount)}</span></div>` : ''}
      ${order.taxAmount > 0 ? `<div><span>Pajak</span><span>${formatPrice(order.taxAmount)}</span></div>` : ''}
      <div class="grand-total"><span>TOTAL</span><span>${formatPrice(order.totalPrice)}</span></div>
      <div><span>${order.paymentMethod || '-'}</span><span>${formatPrice(order.totalPrice)}</span></div>
    </div>

    <div class="footer">
      Terima kasih atas kunjungan Anda
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
