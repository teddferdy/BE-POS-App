'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  ROW_FIELDS,
  META_FIELDS,
  validateMappingArtifact,
  readMappingArtifactFile
} = require('../scripts/tenant-mapping-artifact')
const { validateStoreMapping } = require('../scripts/tenant-backfill-preflight')

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

const baseMeta = (overrides = {}) => ({
  preparer: 'preparer@example.test',
  reviewer: 'reviewer@example.test',
  approval: 'approved',
  preparedAt: '2026-09-25T00:00:00.000Z',
  reviewedAt: '2026-09-25T01:00:00.000Z',
  evidenceRef: 'review-ticket-123',
  ...overrides
})

const stores = [
  { id: 1, tenantId: null },
  { id: 2, tenantId: 10 }
]

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) deepFreeze(value[key])
  }
  return value
}

describe('approved mapping artifact (T-02)', () => {
  test('accepts a canonical { rows, meta } artifact', () => {
    const result = validateMappingArtifact({ rows: [baseRow()], meta: baseMeta() }, stores)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.meta).toEqual({
      preparer: 'preparer@example.test',
      reviewer: 'reviewer@example.test',
      approval: 'approved',
      preparedAt: '2026-09-25T00:00:00.000Z',
      reviewedAt: '2026-09-25T01:00:00.000Z',
      evidenceRef: 'review-ticket-123'
    })
    expect(result.summary).toEqual(expect.objectContaining({ valid: true, mapped: 1 }))
  })

  test('bare arrays belong to the legacy boundary and are rejected as approved artifacts', () => {
    const rejected = validateMappingArtifact([baseRow()], stores)

    expect(rejected.valid).toBe(false)
    expect(rejected.errors).toEqual([
      expect.objectContaining({ code: 'INVALID_ARTIFACT_SHAPE', field: 'artifact' })
    ])

    // Legacy compatibility is preserved where intended: the frozen preflight
    // still accepts the same bare array.
    const legacy = validateStoreMapping([baseRow()], stores)
    expect(legacy.valid).toBe(true)
  })

  test('rejects { rows } without meta while legacy still accepts it', () => {
    const result = validateMappingArtifact({ rows: [baseRow()] }, stores)

    expect(result.valid).toBe(false)
    expect(result.meta).toBeNull()
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'MISSING_META', field: 'meta' })
    ])

    const legacy = validateStoreMapping({ rows: [baseRow()] }, stores)
    expect(legacy.valid).toBe(true)
  })

  test('rejects missing preparer even when source is present (preparer is never inferred)', () => {
    const meta = baseMeta()
    delete meta.preparer

    const result = validateMappingArtifact({ rows: [baseRow()], meta }, stores)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'MISSING_PREPARER', field: 'meta.preparer' })
    ])
  })

  test('rejects missing reviewer', () => {
    const meta = baseMeta()
    delete meta.reviewer

    const result = validateMappingArtifact({ rows: [baseRow()], meta }, stores)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'MISSING_REVIEWER', field: 'meta.reviewer' })
    ])
  })

  test('rejects non-approved artifact approval', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: baseMeta({ approval: 'pending' }) },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'UNAPPROVED', field: 'meta.approval' })
    ])
  })

  test('reviewer is the approver: no approver concept exists in a valid artifact', () => {
    const result = validateMappingArtifact({ rows: [baseRow()], meta: baseMeta() }, stores)

    expect(result.valid).toBe(true)
    expect(Object.keys(result.meta).sort()).toEqual([
      'approval',
      'evidenceRef',
      'preparedAt',
      'preparer',
      'reviewedAt',
      'reviewer'
    ])
  })

  test('rejects a separate approver field on rows as unknown', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow({ approver: 'someone@example.test' })], meta: baseMeta() },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_ROW_FIELD', field: 'rows[0].approver' })
    ])
  })

  test('rejects a separate approver field on meta as unknown', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: { ...baseMeta(), approver: 'someone@example.test' } },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_META_FIELD', field: 'meta.approver' })
    ])
  })

  test('rejects unknown row fields under the strict contract', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow({ ticket: 'T-1' })], meta: baseMeta() },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_ROW_FIELD', field: 'rows[0].ticket' })
    ])
  })

  test('rejects unknown meta fields', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: { ...baseMeta(), batch: 'B-1' } },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_META_FIELD', field: 'meta.batch' })
    ])
  })

  test.each([
    ['not-a-date'],
    ['2026-13-01T00:00:00.000Z'],
    ['2026-02-30T00:00:00.000Z'],
    ['2026-09-25 00:00:00'],
    ['2026-09-25T00:00:00.000+07:00']
  ])('rejects invalid preparedAt values: %p', (preparedAt) => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: baseMeta({ preparedAt }) },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'INVALID_PREPARED_AT', field: 'meta.preparedAt' })
    ])
  })

  test.each([
    ['tomorrow'],
    ['2026-09-25T25:00:00.000Z']
  ])('rejects invalid reviewedAt values: %p', (reviewedAt) => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: baseMeta({ reviewedAt }) },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'INVALID_REVIEWED_AT', field: 'meta.reviewedAt' })
    ])
  })

  test.each([
    ['2026-09-25T00:00:00.000Z'],
    ['2026-09-25T00:00:00Z'],
    ['2026-09-25T00:00:00.5Z']
  ])('accepts valid ISO-8601 UTC timestamps: %p', (stamp) => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: baseMeta({ preparedAt: stamp, reviewedAt: stamp }) },
      stores
    )

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  test('D7 SELF_APPROVAL still rejects self-approved rows', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow({ source: 'reviewer@example.test' })], meta: baseMeta() },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'SELF_APPROVAL', field: 'reviewer', rowIndex: 0 })
    ])
  })

  test('D7 case variant still rejected', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow({ source: 'REVIEWER@EXAMPLE.TEST' })], meta: baseMeta() },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'SELF_APPROVAL', field: 'reviewer' })
    ])
  })

  test('D7 whitespace variant still rejected', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow({ source: '  reviewer@example.test  ' })], meta: baseMeta() },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'SELF_APPROVAL', field: 'reviewer' })
    ])
  })

  test('accepts distinct preparer and reviewer identities', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: baseMeta({ preparer: 'alice@example.test' }) },
      stores
    )

    expect(result.valid).toBe(true)
    expect(result.meta).toEqual(expect.objectContaining({ preparer: 'alice@example.test' }))
  })

  test('preparer and reviewer independence: identical identities are also accepted', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: baseMeta({ preparer: 'reviewer@example.test' }) },
      stores
    )

    expect(result.valid).toBe(true)
  })

  test('binds meta.reviewer to every row reviewer', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow()], meta: baseMeta({ reviewer: 'other@example.test' }) },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'META_REVIEWER_MISMATCH', field: 'meta.reviewer', rowIndex: 0 })
    ])
  })

  test('rejects duplicate store IDs', () => {
    const result = validateMappingArtifact(
      { rows: [baseRow(), baseRow({ tenantId: 10 })], meta: baseMeta() },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'DUPLICATE_STORE_ID', rowIndex: 0 }),
      expect.objectContaining({ code: 'DUPLICATE_STORE_ID', rowIndex: 1 })
    ])
  })

  test('orders errors deterministically across strict and legacy layers', () => {
    const result = validateMappingArtifact(
      {
        rows: [baseRow({ disposition: 'ASSIGN', source: 'reviewer@example.test' })],
        meta: baseMeta()
      },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toEqual([
      'SELF_APPROVAL',
      'UNKNOWN_DISPOSITION'
    ])
  })

  test('preserves rowIndex across multiple failing rows', () => {
    const result = validateMappingArtifact(
      {
        rows: [
          baseRow({ storeId: 1, source: 'reviewer@example.test' }),
          baseRow({ storeId: 2, source: 'reviewer@example.test' })
        ],
        meta: baseMeta()
      },
      stores
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'SELF_APPROVAL', rowIndex: 0 }),
      expect.objectContaining({ code: 'SELF_APPROVAL', rowIndex: 1 })
    ])
  })

  test('validates evidence metadata shape', () => {
    const withoutRef = baseMeta()
    delete withoutRef.evidenceRef
    const missing = validateMappingArtifact({ rows: [baseRow()], meta: withoutRef }, stores)
    expect(missing.valid).toBe(false)
    expect(missing.errors).toEqual([
      expect.objectContaining({ code: 'MISSING_EVIDENCE_REF', field: 'meta.evidenceRef' })
    ])

    const empty = validateMappingArtifact(
      { rows: [baseRow()], meta: baseMeta({ evidenceRef: '   ' }) },
      stores
    )
    expect(empty.valid).toBe(false)
    expect(empty.errors).toEqual([
      expect.objectContaining({ code: 'MISSING_EVIDENCE_REF', field: 'meta.evidenceRef' })
    ])
  })

  test('performs no database write and mutates no input during artifact validation', () => {
    const artifact = deepFreeze({ rows: [baseRow()], meta: baseMeta() })
    const snapshot = JSON.stringify(artifact)
    const frozenStores = deepFreeze([...stores])

    const result = validateMappingArtifact(artifact, frozenStores)

    expect(result.valid).toBe(true)
    expect(JSON.stringify(artifact)).toBe(snapshot)
  })

  test('reads a file-based JSON artifact deterministically', () => {
    const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-artifact-')), 'artifact.json')
    fs.writeFileSync(filePath, JSON.stringify({ rows: [baseRow()], meta: baseMeta() }), 'utf8')

    const loaded = readMappingArtifactFile(filePath)
    const result = validateMappingArtifact(loaded, stores)

    expect(result.valid).toBe(true)
    expect(result.meta).toEqual(expect.objectContaining({ evidenceRef: 'review-ticket-123' }))
  })

  test('rejects unreadable and malformed artifact files with descriptive errors', () => {
    expect(() => readMappingArtifactFile(path.join(os.tmpdir(), 'mapping-artifact-does-not-exist.json'))).toThrow(
      /cannot read artifact file/
    )

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-artifact-'))
    const badPath = path.join(dir, 'bad.json')
    fs.writeFileSync(badPath, '{ not json', 'utf8')
    expect(() => readMappingArtifactFile(badPath)).toThrow(/not valid JSON/)
  })

  test('schema file pins the approved contract', () => {
    const schemaPath = path.join(__dirname, '../scripts/tenant-mapping-artifact.schema.json')
    const raw = fs.readFileSync(schemaPath, 'utf8')
    expect(raw).not.toMatch(/"approver"/)
    const schema = JSON.parse(raw)

    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#')
    expect(schema.required.sort()).toEqual(['meta', 'rows'])
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.meta.required.sort()).toEqual([
      'approval',
      'evidenceRef',
      'preparedAt',
      'preparer',
      'reviewedAt',
      'reviewer'
    ])
    expect(schema.properties.meta.additionalProperties).toBe(false)
    expect(schema.properties.rows.minItems).toBe(1)
    expect(schema.properties.rows.items.additionalProperties).toBe(false)
    expect(schema.properties.rows.items.required.sort()).toEqual([
      'approval',
      'disposition',
      'effectiveAt',
      'reviewer',
      'source',
      'storeId'
    ])
    expect([...ROW_FIELDS].sort()).toEqual([
      'approval',
      'disposition',
      'effectiveAt',
      'reviewer',
      'source',
      'storeId',
      'tenantId'
    ])
    expect([...META_FIELDS].sort()).toEqual([
      'approval',
      'evidenceRef',
      'preparedAt',
      'preparer',
      'reviewedAt',
      'reviewer'
    ])
  })

  test('new artifact module never uses JWT claims or database mutation paths as authority', () => {
    const src = fs.readFileSync(path.join(__dirname, '../scripts/tenant-mapping-artifact.js'), 'utf8')
    expect(src).not.toMatch(/jsonwebtoken/)
    expect(src).not.toMatch(/req\.user/)
    expect(src).not.toMatch(/jwt\.verify/)
    expect(src).not.toMatch(/\.update\(/)
    expect(src).not.toMatch(/\.create\(/)
    expect(src).not.toMatch(/\.destroy\(/)
    expect(src).not.toMatch(/sequelize/)
  })
})
