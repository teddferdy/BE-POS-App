// P1: updateTaxConfigSchema must not inject create-schema defaults.
// Pure schema-level tests — this file requires only the validation module
// and its pure utils (no database, no app import).
const {
  createTaxConfigSchema,
  updateTaxConfigSchema
} = require('../api/validation/schemas')

describe('tax-config update schema defaults (P1)', () => {
  test('a partial update with only name injects neither type nor status', () => {
    const parsed = updateTaxConfigSchema.parse({ name: 'x' })
    expect(parsed).toEqual({ name: 'x' })
    expect('type' in parsed).toBe(false)
    expect('status' in parsed).toBe(false)
  })

  test('omitted type parses to undefined so a service-charge row keeps its type', () => {
    const parsed = updateTaxConfigSchema.parse({ name: 'x', rate: 5 })
    expect(parsed.type).toBeUndefined()
  })

  test('omitted status parses to undefined so an inactive row keeps its status', () => {
    const parsed = updateTaxConfigSchema.parse({ name: 'x', rate: 5 })
    expect(parsed.status).toBeUndefined()
  })

  test('explicit valid type and status updates still work', () => {
    const parsed = updateTaxConfigSchema.parse({
      name: 'x',
      type: 'service_charge',
      status: 'inactive'
    })
    expect(parsed.type).toBe('service_charge')
    expect(parsed.status).toBe('inactive')
  })

  test('invalid explicit values are still rejected', () => {
    expect(() =>
      updateTaxConfigSchema.parse({ name: 'x', type: 'bogus' })
    ).toThrow()
    expect(() =>
      updateTaxConfigSchema.parse({ name: 'x', status: 'archived' })
    ).toThrow()
  })

  test('create-schema defaults remain unchanged', () => {
    const parsed = createTaxConfigSchema.parse({ name: 'x', rate: 5 })
    expect(parsed.type).toBe('ppn')
    expect(parsed.status).toBe('active')
  })
})
