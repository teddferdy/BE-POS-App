'use strict'

// Canonical fractional unit source: reuse FE unitOptions + BE product/ingredient unit strings.
// Fractional-capable units are measurement-based (kg, gram, liter, ml, meter, cm) that naturally support decimals.
// Count-based units (pcs, box, pack, etc.) remain integer-only.
const FRACTIONAL_UNITS = new Set([
  'kg',
  'kilogram',
  'kilograms',
  'gram',
  'g',
  'gramm',
  'liter',
  'litre',
  'l',
  'ml',
  'milliliter',
  'millilitre',
  'meter',
  'metre',
  'm',
  'cm',
  'centimeter',
  'centimetre',
  'mm',
  'millimeter',
  'millimetre'
])

function normalizeUnit(unit) {
  if (!unit || typeof unit !== 'string') return ''
  return unit.trim().toLowerCase()
}

function isFractionalUnit(unit) {
  return FRACTIONAL_UNITS.has(normalizeUnit(unit))
}

function isCountUnit(unit) {
  // Count units are default integer-only; includes pcs variants
  const u = normalizeUnit(unit)
  if (!u) return true // default to count if unknown/empty
  return !isFractionalUnit(u)
}

function assertQuantityForUnit(quantity, unit) {
  const qty = Number(quantity)
  if (!Number.isFinite(qty)) throw new Error(`Invalid quantity for unit ${unit}: must be finite number`)
  if (qty <= 0) throw new Error(`Quantity must be >0 for unit ${unit}`)
  if (isCountUnit(unit) && !Number.isInteger(qty)) {
    throw new Error(`Quantity for unit "${unit}" must be integer (got ${qty})`)
  }
  // For fractional, allow up to 4 decimal places, but don't silently truncate
  // DB DECIMAL(10,4) will round/truncate beyond 4 decimals; we validate scale
  const parts = String(qty).split('.')
  if (parts[1] && parts[1].length > 4) {
    throw new Error(`Quantity for unit "${unit}" exceeds 4 decimal places: ${qty}`)
  }
  return qty
}

module.exports = { FRACTIONAL_UNITS, isFractionalUnit, isCountUnit, assertQuantityForUnit, normalizeUnit }
