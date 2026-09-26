'use strict'

const { DISPOSITIONS, validateStoreMapping, validateMappingRow } = require('../scripts/tenant-backfill-preflight')

const baseRow = (overrides = {}) => ({
  storeId: 1,
  disposition: 'MAP',
  tenantId: 10,
  source: 'migration-review',
  reviewer: 'reviewer@example.test',
  approval: 'approved',
  effectiveAt: '2026-09-25T00:00:00.000Z',
  ...overrides
})

const stores = [
  { id: 1, tenantId: null },
  { id: 2, tenantId: 10 },
  { id: 3, tenantId: 20 }
]

describe('tenant backfill mapping preflight', () => {
  test('accepts a valid MAP row and returns a machine-readable summary', () => {
    const result = validateStoreMapping([baseRow()], stores)

    expect(result).toEqual({
      valid: true,
      mapped: 1,
      quarantined: 0,
      global: 0,
      retired: 0,
      unresolved: 0,
      errors: []
    })
  })

  test('requires tenantId for MAP', () => {
    const result = validateStoreMapping([baseRow({ tenantId: null })], stores)

    expect(result.valid).toBe(false)
    expect(result.mapped).toBe(0)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([expect.objectContaining({ code: 'MAP_TENANT_REQUIRED' })])
  })

  test('QUARANTINE cannot produce operational authority', () => {
    const result = validateStoreMapping([baseRow({ disposition: 'QUARANTINE', tenantId: null })], stores)

    expect(result.mapped).toBe(0)
    expect(result.quarantined).toBe(1)
    expect(result.valid).toBe(true)
  })

  test('GLOBAL is only classified when explicitly dispositioned', () => {
    const inferred = validateStoreMapping([baseRow({ disposition: 'MAP', tenantId: null })], stores)
    const explicit = validateStoreMapping([baseRow({ disposition: 'GLOBAL', tenantId: null })], stores)

    expect(inferred.global).toBe(0)
    expect(inferred.unresolved).toBe(1)
    expect(explicit.global).toBe(1)
    expect(explicit.mapped).toBe(0)
    expect(explicit.valid).toBe(true)
  })

  test('RETIRE has no operational authority', () => {
    const result = validateStoreMapping([baseRow({ disposition: 'RETIRE', tenantId: null })], stores)

    expect(result.mapped).toBe(0)
    expect(result.retired).toBe(1)
    expect(result.valid).toBe(true)
  })

  test('rejects duplicate storeId rows', () => {
    const result = validateStoreMapping([
      baseRow(),
      baseRow({ tenantId: 20 })
    ], stores)

    expect(result.valid).toBe(false)
    expect(result.mapped).toBe(0)
    expect(result.unresolved).toBe(2)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'DUPLICATE_STORE_ID' }),
      expect.objectContaining({ code: 'DUPLICATE_STORE_ID' })
    ])
  })

  test('rejects a store that belongs to a different tenant', () => {
    const result = validateStoreMapping([baseRow({ storeId: 2, tenantId: 20 })], stores)

    expect(result.valid).toBe(false)
    expect(result.mapped).toBe(0)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([expect.objectContaining({ code: 'STORE_TENANT_MISMATCH' })])
  })

  test.each([
    ['source', 'MISSING_SOURCE'],
    ['reviewer', 'MISSING_REVIEWER'],
    ['approval', 'MISSING_APPROVAL'],
    ['effectiveAt', 'MISSING_EFFECTIVE_AT']
  ])('rejects missing %s', (field, code) => {
    const row = baseRow()
    delete row[field]

    const result = validateStoreMapping([row], stores)

    expect(result.valid).toBe(false)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([expect.objectContaining({ code })])
  })

  test('rejects an unapproved row', () => {
    const result = validateStoreMapping([baseRow({ approval: 'pending' })], stores)

    expect(result.valid).toBe(false)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([expect.objectContaining({ code: 'UNAPPROVED' })])
  })

  test('rejects unknown dispositions', () => {
    const result = validateStoreMapping([baseRow({ disposition: 'ASSIGN' })], stores)

    expect(result.valid).toBe(false)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([expect.objectContaining({ code: 'UNKNOWN_DISPOSITION' })])
  })

  test('validateMappingRow normalizes a valid row without consulting persisted stores', () => {
    const result = validateMappingRow(baseRow({ storeId: '7' }))

    expect(result).toEqual({
      row: {
        storeId: 7,
        disposition: 'MAP',
        tenantId: 10,
        source: 'migration-review',
        reviewer: 'reviewer@example.test',
        approval: 'approved',
        effectiveAt: '2026-09-25T00:00:00.000Z'
      },
      disposition: 'MAP',
      errors: []
    })
  })

  test.each([
    [[], 'EMPTY_MAPPING_ARTIFACT'],
    [null, 'INVALID_MAPPING_ARTIFACT'],
    [{}, 'INVALID_MAPPING_ARTIFACT'],
    [{ rows: 'invalid' }, 'INVALID_MAPPING_ARTIFACT'],
    [{ rows: [] }, 'EMPTY_MAPPING_ARTIFACT']
  ])('rejects empty or malformed mapping artifacts', (mappingRows, code) => {
    const result = validateStoreMapping(mappingRows, stores)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([expect.objectContaining({ code })])
  })

  test('rejects a mapping row whose store is missing', () => {
    const result = validateStoreMapping([baseRow({ storeId: 999 })], stores)

    expect(result.valid).toBe(false)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([expect.objectContaining({ code: 'STORE_NOT_FOUND', rowIndex: 0 })])
  })

  test.each([
    true,
    1n,
    [],
    {},
    ' 1',
    '01',
    1.5,
    Symbol('1')
  ])('rejects malformed mapping store IDs without throwing: %p', (storeId) => {
    let result
    expect(() => {
      result = validateStoreMapping([baseRow({ storeId })], stores)
    }).not.toThrow()
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([expect.objectContaining({ code: 'INVALID_STORE_ID' })])
  })

  test.each([
    true,
    1n,
    [],
    {},
    ' 1',
    '01',
    1.5,
    Symbol('1')
  ])('rejects malformed mapping tenant IDs without throwing: %p', (tenantId) => {
    let result
    expect(() => {
      result = validateStoreMapping([baseRow({ tenantId })], stores)
    }).not.toThrow()
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_TENANT_ID' })
    ]))
  })

  test.each([
    true,
    1n,
    [],
    {},
    ' 1',
    '01',
    1.5,
    Symbol('1')
  ])('rejects malformed persisted tenant IDs: %p', (tenantId) => {
    const result = validateStoreMapping([baseRow()], [{ id: 1, tenantId }])

    expect(result.valid).toBe(false)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([expect.objectContaining({ code: 'INVALID_PERSISTED_TENANT_ID' })])
  })

  test('rejects duplicate persisted store snapshots', () => {
    const result = validateStoreMapping([baseRow()], [
      { id: 1, tenantId: null },
      { id: '1', tenantId: null }
    ])

    expect(result.valid).toBe(false)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([expect.objectContaining({ code: 'AMBIGUOUS_STORE' })])
  })

  test('includes deterministic rowIndex values for multiple row errors', () => {
    const result = validateStoreMapping([
      baseRow({ storeId: 999 }),
      baseRow({ disposition: 'ASSIGN' })
    ], stores)

    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'STORE_NOT_FOUND', rowIndex: 0 }),
      expect.objectContaining({ code: 'UNKNOWN_DISPOSITION', rowIndex: 1 })
    ])
  })

  test('orders multiple errors by stable code values', () => {
    const row = baseRow()
    delete row.source
    delete row.reviewer
    delete row.approval
    delete row.effectiveAt

    const result = validateStoreMapping([row], stores)

    expect(result.errors.map((error) => error.code)).toEqual([
      'MISSING_APPROVAL',
      'MISSING_EFFECTIVE_AT',
      'MISSING_REVIEWER',
      'MISSING_SOURCE'
    ])
  })

  test('does not mutate mapping rows or persisted store snapshots', () => {
    const rows = [baseRow()]
    const storeSnapshots = [{ id: 1, tenantId: null }]
    const before = JSON.stringify({ rows, storeSnapshots })

    validateStoreMapping(rows, storeSnapshots)

    expect(JSON.stringify({ rows, storeSnapshots })).toBe(before)
  })

  test('exports an immutable disposition collection', () => {
    expect(Object.isFrozen(DISPOSITIONS)).toBe(true)
    expect(() => DISPOSITIONS.push('OTHER')).toThrow(TypeError)
  })
})
