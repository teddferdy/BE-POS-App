// P1 Outlet Pricing Hardening: Fix C — Catalog Price Resolver Error Handling
//
// Regression tests covering getEffectivePriceMap's silent error swallowing.
// The defect: all DB errors are caught and silently ignored, causing catalog/menu
// endpoints to return base prices during connection failures, permission errors, etc.
//
// Required behavior:
// - Outlet row exists → use outlet price.
// - Outlet row absent → use base price fallback.
// - Explicit zero outlet price → valid, use it.
// - NULL outlet price → documented missing-price behavior.
// - Missing table (SQLSTATE 42P01) → may tolerate if compatibility requires.
// - Connection/permission/timeout/other DB errors → must propagate, not silent fallback.

const db = require('../db/models')
const { getEffectivePriceMap } = require('../utils/outletPricing')

const products = [
  { id: 1, nameProduct: 'Coffee', price: 5000 },
  { id: 2, nameProduct: 'Tea', price: 3000 },
  { id: 3, nameProduct: 'Juice', price: 7000 }
]

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getEffectivePriceMap — error handling', () => {
  test('outlet row exists → returns outlet price', async () => {
    jest.spyOn(db.product_store_price, 'findAll').mockResolvedValue([
      { product: 1, store: 10, price: 6000 },
      { product: 2, store: 10, price: 3500 }
    ])

    const priceMap = await getEffectivePriceMap(products, 10)

    expect(priceMap).toEqual({
      1: 6000,
      2: 3500,
      3: 7000
    })
  })

  test('outlet row absent → returns base price', async () => {
    jest.spyOn(db.product_store_price, 'findAll').mockResolvedValue([])

    const priceMap = await getEffectivePriceMap(products, 10)

    expect(priceMap).toEqual({
      1: 5000,
      2: 3000,
      3: 7000
    })
  })

  test('explicit zero outlet price → returns zero', async () => {
    jest.spyOn(db.product_store_price, 'findAll').mockResolvedValue([
      { product: 1, store: 10, price: 0 }
    ])

    const priceMap = await getEffectivePriceMap(products, 10)

    expect(priceMap).toEqual({
      1: 0,
      2: 3000,
      3: 7000
    })
  })

  test('NULL outlet price → falls back to base', async () => {
    jest.spyOn(db.product_store_price, 'findAll').mockResolvedValue([
      { product: 1, store: 10, price: null }
    ])

    const priceMap = await getEffectivePriceMap(products, 10)

    expect(priceMap).toEqual({
      1: 5000,
      2: 3000,
      3: 7000
    })
  })

  test('missing table error (SQLSTATE 42P01) → may tolerate fallback', async () => {
    const err = new Error('relation "product_store_price" does not exist')
    err.code = '42P01'
    jest.spyOn(db.product_store_price, 'findAll').mockRejectedValue(err)

    // If compatibility contract requires it, missing table may return base prices
    // Otherwise this should propagate. Adjust based on authoritative BA guidance.
    const priceMap = await getEffectivePriceMap(products, 10)

    expect(priceMap).toEqual({
      1: 5000,
      2: 3000,
      3: 7000
    })
  })

  test('connection error → propagates as error', async () => {
    const err = new Error('connection refused')
    err.code = 'ECONNREFUSED'
    jest.spyOn(db.product_store_price, 'findAll').mockRejectedValue(err)

    await expect(getEffectivePriceMap(products, 10)).rejects.toThrow('connection refused')
  })

  test('permission error → propagates as error', async () => {
    const err = new Error('permission denied for table product_store_price')
    err.code = '42501'
    jest.spyOn(db.product_store_price, 'findAll').mockRejectedValue(err)

    await expect(getEffectivePriceMap(products, 10)).rejects.toThrow('permission denied')
  })

  test('timeout error → propagates as error', async () => {
    const err = new Error('query timeout')
    err.code = '57014'
    jest.spyOn(db.product_store_price, 'findAll').mockRejectedValue(err)

    await expect(getEffectivePriceMap(products, 10)).rejects.toThrow('query timeout')
  })

  test('generic database error → propagates as error', async () => {
    const err = new Error('database is shutting down')
    jest.spyOn(db.product_store_price, 'findAll').mockRejectedValue(err)

    await expect(getEffectivePriceMap(products, 10)).rejects.toThrow('database is shutting down')
  })

  test('malformed query error → propagates as error', async () => {
    const err = new Error('syntax error at or near "WHERE"')
    err.code = '42601'
    jest.spyOn(db.product_store_price, 'findAll').mockRejectedValue(err)

    await expect(getEffectivePriceMap(products, 10)).rejects.toThrow('syntax error')
  })
})
