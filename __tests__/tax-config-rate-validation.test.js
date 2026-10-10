// T1: tax rates must be finite numbers. NaN/Infinity can never be valid
// under any rate policy (no maximum/decimal decision implied — finite
// decimals and large integers remain accepted). Pure schema-level tests:
// this file requires only the validation module (no database, no app).
const {
  createTaxConfigSchema,
  updateTaxConfigSchema
} = require('../api/validation/schemas')

describe('tax-config rate finiteness (T1)', () => {
  test.each([['create', createTaxConfigSchema]])(
    '%s rejects non-finite rates',
    (_label, schema) => {
      expect(() =>
        schema.parse({ name: 'x', rate: 'abc' })
      ).toThrow()
      expect(() =>
        schema.parse({ name: 'x', rate: 'Infinity' })
      ).toThrow()
    }
  )

  test('update rejects non-finite rates', () => {
    expect(() =>
      updateTaxConfigSchema.parse({ name: 'x', rate: 'abc' })
    ).toThrow()
    expect(() =>
      updateTaxConfigSchema.parse({ name: 'x', rate: NaN })
    ).toThrow()
  })

  test('finite integers, decimals, and numeric strings remain accepted', () => {
    expect(createTaxConfigSchema.parse({ name: 'x', rate: 11 }).rate).toBe(11)
    expect(createTaxConfigSchema.parse({ name: 'x', rate: 10.5 }).rate).toBe(10.5)
    expect(createTaxConfigSchema.parse({ name: 'x', rate: '11' }).rate).toBe(11)
    expect(updateTaxConfigSchema.parse({ name: 'x', rate: 0 }).rate).toBe(0)
  })
})
