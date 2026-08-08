'use strict'
const db = require('../../db/models')

const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset', normalBalance: 'debit', description: 'Kas dan setara kas' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit', description: 'Piutang usaha' },
  { code: '1200', name: 'Inventory', type: 'asset', normalBalance: 'debit', description: 'Persediaan barang dagang' },
  { code: '1300', name: 'Fixed Assets', type: 'asset', normalBalance: 'debit', description: 'Aset tetap' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit', description: 'Utang usaha' },
  { code: '2100', name: 'Tax Payable', type: 'liability', normalBalance: 'credit', description: 'Utang pajak' },
  { code: '3000', name: 'Owner Capital', type: 'equity', normalBalance: 'credit', description: 'Modal pemilik' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', normalBalance: 'credit', description: 'Laba ditahan' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue', normalBalance: 'credit', description: 'Pendapatan penjualan' },
  { code: '4100', name: 'Service Charge Revenue', type: 'revenue', normalBalance: 'credit', description: 'Pendapatan service charge' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', normalBalance: 'debit', description: 'Harga pokok penjualan' },
  { code: '6000', name: 'Operating Expenses', type: 'expense', normalBalance: 'debit', description: 'Beban operasional' },
  { code: '6100', name: 'Salaries & Wages', type: 'expense', normalBalance: 'debit', description: 'Beban gaji' }
]

const toNumber = (v) => Math.round((Number(v) || 0) * 100) / 100

const findAccount = async (store, code) => {
  return db.account.findOne({
    where: { store, code, status: 'active' }
  })
}

const findOrCreateAccount = async (store, code, overrides = {}, createdBy = null) => {
  const existing = await db.account.findOne({ where: { store, code } })
  if (existing) return existing
  const defaults = DEFAULT_ACCOUNTS.find((a) => a.code === code)
  if (!defaults && !overrides.name) return null
  return db.account.create({
    store,
    code,
    name: overrides.name || defaults.name,
    type: overrides.type || defaults.type,
    normalBalance: overrides.normalBalance || defaults.normalBalance,
    description: overrides.description || defaults.description || null,
    isSystem: true,
    createdBy
  })
}

async function ensureDefaultAccounts(store, createdBy = null) {
  if (!store) return []
  const existing = await db.account.count({ where: { store } })
  if (existing > 0) return []
  const created = []
  for (const acc of DEFAULT_ACCOUNTS) {
    created.push(
      await db.account.create({
        store,
        ...acc,
        isSystem: true,
        createdBy
      })
    )
  }
  return created
}

function makeEntryNumber(store, seq) {
  const pad = String(seq || 1).padStart(6, '0')
  return `JV-${String(store).padStart(4, '0')}-${pad}`
}

async function nextSeq(store) {
  const last = await db.journal_entry.findOne({
    where: { store },
    order: [['id', 'DESC']],
    paranoid: false
  })
  return (last?.id || 0) + 1
}

async function existingEntry(store, sourceType, referenceId) {
  return db.journal_entry.findOne({
    where: { store, sourceType, referenceId: referenceId || null }
  })
}

// Core double-entry writer: balances lines, dedupes by (sourceType, referenceId)
// and never throws — callers must not break the primary transaction.
async function createJournalEntry({ store, date, description, sourceType, referenceId, lines, createdBy }) {
  try {
    if (!store || !lines || lines.length === 0) return null
    await ensureDefaultAccounts(store, createdBy)

    const clean = lines
      .filter((l) => toNumber(l.debit) > 0 || toNumber(l.credit) > 0)
      .map((l) => ({
        account: l.account,
        debit: toNumber(l.debit),
        credit: toNumber(l.credit),
        description: l.description || null
      }))
    if (clean.length === 0) return null

    const totalDebit = toNumber(clean.reduce((s, l) => s + l.debit, 0))
    const totalCredit = toNumber(clean.reduce((s, l) => s + l.credit, 0))
    if (totalDebit <= 0 && totalCredit <= 0) return null

    const dup = await existingEntry(store, sourceType, referenceId)
    if (dup) return dup

    const seq = await nextSeq(store)
    const entry = await db.journal_entry.create({
      store,
      entryNumber: makeEntryNumber(store, seq),
      date: date || new Date(),
      description: description || sourceType,
      sourceType,
      referenceId: referenceId || null,
      totalDebit,
      totalCredit,
      createdBy
    })
    for (const line of clean) {
      await db.journal_entry_line.create({ ...line, journalEntry: entry.id, createdBy })
    }
    return entry
  } catch (error) {
    console.error(`createJournalEntry(${sourceType}) error:`, error.message)
    return null
  }
}

// Reverse an existing entry by creating a new entry with swapped debit/credit.
async function createReversalEntry({ store, originalEntry, description, sourceType, referenceId, date, createdBy }) {
  const lines = await db.journal_entry_line.findAll({
    where: { journalEntry: originalEntry.id }
  })
  const reversed = lines.map((l) => ({
    account: l.account,
    debit: toNumber(l.credit),
    credit: toNumber(l.debit),
    description: l.description ? `Reversal: ${l.description}` : null
  }))
  return createJournalEntry({
    store,
    date,
    description: description || `Reversal of ${originalEntry.description || originalEntry.sourceType}`,
    sourceType,
    referenceId: referenceId ?? originalEntry.referenceId,
    lines: reversed,
    createdBy
  })
}

async function postOrderJournal({ store, orderId, orderNumber, subTotal, discountAmount, taxAmount, serviceChargeAmount, totalPrice, date, createdBy }) {
  const sub = toNumber(subTotal)
  const disc = toNumber(discountAmount)
  const tax = toNumber(taxAmount)
  const sc = toNumber(serviceChargeAmount)
  const total = toNumber(totalPrice)

  const revenueAmount = toNumber(sub - disc)
  if (total <= 0) return null

  const cashEntry = await findOrCreateAccount(store, '1000')
  const revenueEntry = await findOrCreateAccount(store, '4000')
  if (!cashEntry || !revenueEntry) return null

  const lines = [
    { account: cashEntry.id, debit: total, credit: 0, description: `Payment received for ${orderNumber}` }
  ]
  if (revenueAmount > 0) {
    lines.push({ account: revenueEntry.id, debit: 0, credit: revenueAmount, description: `Sales revenue for ${orderNumber}` })
  }
  if (tax > 0) {
    const taxAcc = await findOrCreateAccount(store, '2100')
    if (taxAcc) lines.push({ account: taxAcc.id, debit: 0, credit: tax, description: `Tax collected for ${orderNumber}` })
  }
  if (sc > 0) {
    const scAcc = await findOrCreateAccount(store, '4100')
    if (scAcc) lines.push({ account: scAcc.id, debit: 0, credit: sc, description: `Service charge for ${orderNumber}` })
  }

  const totalDebit = toNumber(lines.reduce((s, l) => s + l.debit, 0))
  const totalCredit = toNumber(lines.reduce((s, l) => s + l.credit, 0))
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    lines.push({
      account: revenueEntry.id,
      debit: 0,
      credit: toNumber(totalDebit - totalCredit),
      description: `Rounding adjustment for ${orderNumber}`
    })
  }

  return createJournalEntry({
    store,
    date,
    description: `Sales ${orderNumber}`,
    sourceType: 'order',
    referenceId: orderId,
    lines,
    createdBy
  })
}

// COGS = Σ (hppSnapshot × quantity). Bundles use current component cost.
async function computeOrderCogs(orderId) {
  const items = await db.order_item.findAll({ where: { order: orderId } })
  let total = 0
  for (const item of items) {
    const qty = Number(item.quantity) || 0
    if (qty <= 0) continue
    if (item.bundleId) {
      const comps = await db.product_bundle_item.findAll({
        where: { bundleId: item.bundleId }
      })
      let bundleCost = 0
      for (const c of comps) {
        const p = await db.product.findByPk(c.product)
        if (p) bundleCost += (Number(c.quantity) || 0) * (Number(p.costPrice || p.price) || 0)
      }
      total += bundleCost * qty
    } else {
      total += (Number(item.hppSnapshot) || 0) * qty
    }
  }
  return toNumber(total)
}

async function postOrderCogsJournal({ store, orderId, orderNumber, date, createdBy }) {
  const cogsTotal = await computeOrderCogs(orderId)
  if (cogsTotal <= 0) return null

  const cogsAcc = await findOrCreateAccount(store, '5000')
  const inventoryAcc = await findOrCreateAccount(store, '1200')
  if (!cogsAcc || !inventoryAcc) return null

  return createJournalEntry({
    store,
    date,
    description: `COGS for ${orderNumber}`,
    sourceType: 'cogs',
    referenceId: orderId,
    lines: [
      { account: cogsAcc.id, debit: cogsTotal, credit: 0, description: `Cost of goods sold for ${orderNumber}` },
      { account: inventoryAcc.id, debit: 0, credit: cogsTotal, description: `Inventory consumed for ${orderNumber}` }
    ],
    createdBy
  })
}

// Purchase journal at goods receipt: Dr Inventory, Cr AP (net of PO discount).
async function postPurchaseJournal({ store, receiptId, receiptNumber, poId, poNumber, totalAmount, discount, items, date, createdBy }) {
  const gross = items.reduce(
    (s, i) => s + Math.round((Number(i.costPrice) || 0) * (Number(i.qtyReceived) || 0)),
    0
  )
  if (gross <= 0) return null

  let net = gross
  const disc = toNumber(discount)
  const poTotal = toNumber(totalAmount)
  if (disc > 0 && poTotal > 0) {
    net = Math.round(gross - (gross * disc) / poTotal)
  }
  if (net <= 0) return null

  const inventoryAcc = await findOrCreateAccount(store, '1200')
  const apAcc = await findOrCreateAccount(store, '2000')
  if (!inventoryAcc || !apAcc) return null

  return createJournalEntry({
    store,
    date,
    description: `Goods receipt ${receiptNumber}${poNumber ? ` (PO: ${poNumber})` : ''}`,
    sourceType: 'purchase',
    referenceId: receiptId,
    lines: [
      { account: inventoryAcc.id, debit: net, credit: 0, description: `Inventory received ${receiptNumber}` },
      { account: apAcc.id, debit: 0, credit: net, description: `Accounts payable for ${receiptNumber}${disc > 0 ? ` (net of PO discount ${disc})` : ''}` }
    ],
    createdBy
  })
}

// Supplier payment: Dr AP, Cr Cash.
async function postPurchasePaymentJournal({ store, paymentId, poNumber, amount, date, createdBy }) {
  const amt = toNumber(amount)
  if (amt <= 0) return null

  const apAcc = await findOrCreateAccount(store, '2000')
  const cashAcc = await findOrCreateAccount(store, '1000')
  if (!apAcc || !cashAcc) return null

  return createJournalEntry({
    store,
    date,
    description: `Payment for PO ${poNumber || ''}`.trim(),
    sourceType: 'purchase_payment',
    referenceId: paymentId,
    lines: [
      { account: apAcc.id, debit: amt, credit: 0, description: `Settle accounts payable ${poNumber || ''}`.trim() },
      { account: cashAcc.id, debit: 0, credit: amt, description: `Cash paid for PO ${poNumber || ''}`.trim() }
    ],
    createdBy
  })
}

// Purchase return reversal: goods go back to supplier → Dr AP, Cr Inventory.
async function postPurchaseReturnJournal({ store, purchaseReturnId, returnNumber, amount, date, createdBy }) {
  const amt = toNumber(amount)
  if (amt <= 0) return null

  const apAcc = await findOrCreateAccount(store, '2000')
  const inventoryAcc = await findOrCreateAccount(store, '1200')
  if (!apAcc || !inventoryAcc) return null

  return createJournalEntry({
    store,
    date,
    description: `Purchase return ${returnNumber}`,
    sourceType: 'purchase_return',
    referenceId: purchaseReturnId,
    lines: [
      { account: apAcc.id, debit: amt, credit: 0, description: `Return credit ${returnNumber}` },
      { account: inventoryAcc.id, debit: 0, credit: amt, description: `Inventory returned ${returnNumber}` }
    ],
    createdBy
  })
}

// Sales return reversal: refund revenue, restore inventory at cost.
async function postSalesReturnJournal({ store, returnId, returnNumber, orderId, refundAmount, items, date, createdBy }) {
  const refund = toNumber(refundAmount)

  let cogsReturned = 0
  for (const it of items || []) {
    const qty = Math.floor(Number(it.qty)) || 0
    if (qty <= 0) continue
    let hpp = 0
    if (it.orderItem) {
      const oi = await db.order_item.findByPk(it.orderItem)
      hpp = Number(oi?.hppSnapshot) || 0
    }
    cogsReturned += hpp * qty
  }
  cogsReturned = toNumber(cogsReturned)

  if (refund <= 0 && cogsReturned <= 0) return null

  const lines = []
  if (refund > 0) {
    const revenueAcc = await findOrCreateAccount(store, '4000')
    const cashAcc = await findOrCreateAccount(store, '1000')
    if (!revenueAcc || !cashAcc) return null
    lines.push(
      { account: revenueAcc.id, debit: refund, credit: 0, description: `Refund revenue for ${returnNumber}` },
      { account: cashAcc.id, debit: 0, credit: refund, description: `Cash refunded for ${returnNumber}` }
    )
  }
  if (cogsReturned > 0) {
    const inventoryAcc = await findOrCreateAccount(store, '1200')
    const cogsAcc = await findOrCreateAccount(store, '5000')
    if (inventoryAcc && cogsAcc) {
      lines.push(
        { account: inventoryAcc.id, debit: cogsReturned, credit: 0, description: `Stock restored for ${returnNumber}` },
        { account: cogsAcc.id, debit: 0, credit: cogsReturned, description: `COGS reversed for ${returnNumber}` }
      )
    }
  }

  return createJournalEntry({
    store,
    date,
    description: `Sales return ${returnNumber}${orderId ? ` (order ${orderId})` : ''}`,
    sourceType: 'sales_return',
    referenceId: returnId,
    lines,
    createdBy
  })
}

// Reverse revenue + COGS journals when an order is cancelled/voided.
async function reverseOrderJournals({ store, orderId, orderNumber, date, createdBy }) {
  const orderEntry = await db.journal_entry.findOne({
    where: { store, sourceType: 'order', referenceId: orderId }
  })
  if (orderEntry) {
    await createReversalEntry({
      store,
      originalEntry: orderEntry,
      description: `Reversal of cancelled order ${orderNumber}`,
      sourceType: 'order_reversal',
      referenceId: orderId,
      date,
      createdBy
    })
  }

  const cogsEntry = await db.journal_entry.findOne({
    where: { store, sourceType: 'cogs', referenceId: orderId }
  })
  if (cogsEntry) {
    await createReversalEntry({
      store,
      originalEntry: cogsEntry,
      description: `Reversal of cancelled order COGS ${orderNumber}`,
      sourceType: 'cogs_reversal',
      referenceId: orderId,
      date,
      createdBy
    })
  }
}

async function postExpenseJournal({ store, expenseId, expenseNumber, category, amount, date, createdBy }) {
  const amt = toNumber(amount)
  if (amt <= 0) return null

  const expenseAcc = await findOrCreateAccount(store, '6000', {
    name: 'Operating Expenses',
    type: 'expense',
    normalBalance: 'debit'
  })
  const cashAcc = await findOrCreateAccount(store, '1000')
  if (!expenseAcc || !cashAcc) return null

  return createJournalEntry({
    store,
    date,
    description: `Expense ${expenseNumber || ''}`.trim(),
    sourceType: 'expense',
    referenceId: expenseId,
    lines: [
      { account: expenseAcc.id, debit: amt, credit: 0, description: category ? `${category}: ${expenseNumber || ''}`.trim() : `Expense ${expenseNumber || ''}`.trim() },
      { account: cashAcc.id, debit: 0, credit: amt, description: `Payment for ${expenseNumber || 'expense'}` }
    ],
    createdBy
  })
}

module.exports = {
  DEFAULT_ACCOUNTS,
  ensureDefaultAccounts,
  findAccount,
  findOrCreateAccount,
  makeEntryNumber,
  postOrderJournal,
  postOrderCogsJournal,
  computeOrderCogs,
  postPurchaseJournal,
  postPurchasePaymentJournal,
  postPurchaseReturnJournal,
  postSalesReturnJournal,
  reverseOrderJournals,
  postExpenseJournal
}
