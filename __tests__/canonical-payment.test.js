process.env.NODE_ENV = 'test'

// PAYMENT P1 — canonical payment-method write boundary (unit tests).
//
// The production change that makes each test fail: introducing
// api/service/canonicalPayment.js with normalizePaymentMethod().
// Deterministic, side-effect free, explicit about unknown values.

const loadService = () => require('../api/service/canonicalPayment')

describe('canonical payment registry', () => {
  test('exposes exactly the seven locked canonical methods, frozen', async () => {
    const { CANONICAL_PAYMENT_METHODS } = loadService()
    expect([...CANONICAL_PAYMENT_METHODS].sort()).toEqual(
      ['BANK_TRANSFER', 'CARD', 'CASH', 'E_WALLET', 'OTHER', 'POINTS', 'QRIS'].sort()
    )
    expect(Object.isFrozen(CANONICAL_PAYMENT_METHODS)).toBe(true)
  })

  test.each([
    ['CASH', 'CASH'],
    ['cash', 'CASH'],
    ['Cash', 'CASH'],
    ['tunai', 'CASH'],
    ['Tunai', 'CASH'],
    ['banknote', 'CASH'],
    ['debit', 'CARD'],
    ['credit', 'CARD'],
    ['Kartu Kredit', 'CARD'],
    ['transfer', 'BANK_TRANSFER'],
    ['e-wallet', 'E_WALLET'],
    ['E-Wallet', 'E_WALLET'],
    ['ewallet', 'E_WALLET'],
    ['qris', 'QRIS'],
    ['QRIS', 'QRIS'],
    ['points', 'POINTS'],
    ['other', 'OTHER']
  ])('alias %p normalizes to %p', async (input, expected) => {
    const { normalizePaymentMethod } = loadService()
    expect(normalizePaymentMethod(input)).toBe(expected)
  })

  test('normalization is idempotent and trims surrounding whitespace', async () => {
    const { normalizePaymentMethod } = loadService()
    expect(normalizePaymentMethod(normalizePaymentMethod('Tunai'))).toBe('CASH')
    expect(normalizePaymentMethod('  cash  ')).toBe('CASH')
  })

  test.each([['Postpaid'], ['Split Bill'], ['bitcoin'], ['foo'], ['random'], ['CASHIER']])(
    'unmappable value %p is refused with 422 and never stored',
    async (input) => {
      const { normalizePaymentMethod } = loadService()
      let error = null
      try {
        normalizePaymentMethod(input)
      } catch (e) {
        error = e
      }
      expect(error).not.toBeNull()
      expect(error.statusCode).toBe(422)
      expect(error.code).toBe('INVALID_PAYMENT_METHOD')
    }
  )

  test.each([[null], [undefined], ['']])('empty value %p normalizes to null (caller enforces requiredness)', async (input) => {
    const { normalizePaymentMethod } = loadService()
    expect(normalizePaymentMethod(input)).toBeNull()
  })

  test('non-string truthy values are refused, not coerced', async () => {
    const { normalizePaymentMethod } = loadService()
    for (const input of [123, true, {}, []]) {
      expect(() => normalizePaymentMethod(input)).toThrow(expect.objectContaining({ statusCode: 422 }))
    }
  })

  // BLOCKER-1 regression: every canonical value must be accepted unchanged
  // (identity mapping). CARD, BANK_TRANSFER and E_WALLET were rejected
  // because the alias map had no identity entries for them, which broke
  // void planning, remainder settlement and sales-return approval flows
  // that legitimately pass canonical tender values back through.
  test.each([
    ['CANONICAL-IDEMPOTENT-01', 'CASH'],
    ['CANONICAL-IDEMPOTENT-02', 'CARD'],
    ['CANONICAL-IDEMPOTENT-03', 'BANK_TRANSFER'],
    ['CANONICAL-IDEMPOTENT-04', 'E_WALLET'],
    ['CANONICAL-IDEMPOTENT-05', 'QRIS'],
    ['CANONICAL-IDEMPOTENT-06', 'POINTS'],
    ['CANONICAL-IDEMPOTENT-07', 'OTHER']
  ])('%s: canonical %p is accepted unchanged', async (_id, input) => {
    const { normalizePaymentMethod } = loadService()
    expect(normalizePaymentMethod(input)).toBe(input)
    expect(normalizePaymentMethod(normalizePaymentMethod(input))).toBe(input)
  })
})
