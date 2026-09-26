'use strict'

const DISPOSITIONS = Object.freeze(['MAP', 'QUARANTINE', 'GLOBAL', 'RETIRE'])
const METADATA_FIELDS = [
  ['source', 'MISSING_SOURCE'],
  ['reviewer', 'MISSING_REVIEWER'],
  ['approval', 'MISSING_APPROVAL'],
  ['effectiveAt', 'MISSING_EFFECTIVE_AT']
]

const readField = (value, field) => {
  if (value && typeof value.get === 'function') return value.get(field)
  return value?.[field]
}

const normalizeId = (value) => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const normalized = Number(value)
    return Number.isSafeInteger(normalized) ? normalized : null
  }
  return null
}

const normalizeText = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

const normalizeApproval = (value) => {
  if (value === true) return 'approved'
  if (value === false) return 'rejected'
  if (typeof value === 'string') return normalizeText(value)?.toLowerCase() || null
  if (value && typeof value === 'object') {
    return normalizeApproval(value.status ?? value.approval ?? value.decision)
  }
  return null
}

const makeError = (code, field, message) => ({ code, field, message })

const compareText = (left, right) => {
  if (left === right) return 0
  return left < right ? -1 : 1
}

const compareErrors = (left, right) =>
  compareText(left.code, right.code) ||
  compareText(left.field, right.field) ||
  compareText(left.message, right.message)

const normalizeRow = (row) => {
  const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {}
  return {
    storeId: normalizeId(source.storeId),
    disposition: normalizeText(source.disposition)?.toUpperCase() || null,
    tenantId: normalizeId(source.tenantId),
    source: normalizeText(source.source),
    reviewer: normalizeText(source.reviewer),
    approval: normalizeApproval(source.approval),
    effectiveAt: normalizeText(source.effectiveAt)
  }
}

const validateMappingRow = (row) => {
  const normalized = normalizeRow(row)
  const errors = []
  const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {}

  if (normalized.storeId === null) {
    errors.push(makeError('INVALID_STORE_ID', 'storeId', 'storeId must be a positive integer'))
  }
  if (!DISPOSITIONS.includes(normalized.disposition)) {
    errors.push(makeError('UNKNOWN_DISPOSITION', 'disposition', 'disposition must be MAP, QUARANTINE, GLOBAL, or RETIRE'))
  }
  if (normalized.disposition === 'MAP' && normalized.tenantId === null) {
    errors.push(makeError('MAP_TENANT_REQUIRED', 'tenantId', 'MAP requires tenantId'))
  }
  if (source.tenantId != null && normalized.tenantId === null) {
    errors.push(makeError('INVALID_TENANT_ID', 'tenantId', 'tenantId must be a positive integer'))
  }
  for (const [field, code] of METADATA_FIELDS) {
    if (normalized[field] === null) {
      errors.push(makeError(code, field, `${field} is required`))
    }
  }
  if (normalized.approval !== null && normalized.approval !== 'approved') {
    errors.push(makeError('UNAPPROVED', 'approval', 'approval must be approved'))
  }

  return {
    row: normalized,
    disposition: normalized.disposition,
    errors
  }
}

const storeSnapshot = (store) => {
  const id = normalizeId(readField(store, 'id') ?? readField(store, 'storeId') ?? readField(store, 'store'))
  const rawTenantId = readField(store, 'tenantId')
  const tenantId = rawTenantId == null ? null : normalizeId(rawTenantId)
  return {
    id,
    tenantId,
    tenantIdValid: rawTenantId == null || tenantId !== null
  }
}

const validateStoreMapping = (mappingRows, stores) => {
  const artifactErrors = []
  let rows
  if (Array.isArray(mappingRows)) {
    rows = mappingRows
  } else if (mappingRows && typeof mappingRows === 'object' && Array.isArray(mappingRows.rows)) {
    rows = mappingRows.rows
  } else {
    rows = []
    artifactErrors.push(makeError('INVALID_MAPPING_ARTIFACT', 'mappingRows', 'mappingRows must be an array or an artifact with a rows array'))
  }
  if (rows.length === 0 && artifactErrors.length === 0) {
    artifactErrors.push(makeError('EMPTY_MAPPING_ARTIFACT', 'mappingRows', 'mappingRows must contain at least one row'))
  }
  const storeRows = Array.isArray(stores) ? stores : []
  const storeById = new Map()
  const ambiguousStoreIds = new Set()

  for (const store of storeRows) {
    const snapshot = storeSnapshot(store)
    if (snapshot.id === null) continue
    if (storeById.has(snapshot.id)) {
      ambiguousStoreIds.add(snapshot.id)
    } else {
      storeById.set(snapshot.id, snapshot)
    }
  }

  const results = rows.map((row) => validateMappingRow(row))
  const rowErrors = results.map(({ errors }) => [...errors])
  const storeIdCounts = new Map()

  for (const result of results) {
    if (result.row.storeId === null) continue
    storeIdCounts.set(result.row.storeId, (storeIdCounts.get(result.row.storeId) || 0) + 1)
  }

  for (const [storeId, count] of storeIdCounts) {
    if (count < 2) continue
    results.forEach((result, index) => {
      if (result.row.storeId === storeId) {
        rowErrors[index].push(makeError('DUPLICATE_STORE_ID', 'storeId', `storeId ${storeId} appears more than once`))
      }
    })
  }

  for (const [index, result] of results.entries()) {
    const { storeId, disposition, tenantId } = result.row
    if (storeId === null) continue
    if (!storeById.has(storeId)) {
      rowErrors[index].push(makeError('STORE_NOT_FOUND', 'storeId', `store ${storeId} was not found`))
      continue
    }
    if (ambiguousStoreIds.has(storeId)) {
      rowErrors[index].push(makeError('AMBIGUOUS_STORE', 'storeId', `store ${storeId} is not unique`))
      continue
    }
    const persisted = storeById.get(storeId)
    if (!persisted.tenantIdValid) {
      rowErrors[index].push(makeError('INVALID_PERSISTED_TENANT_ID', 'tenantId', `store ${storeId} has an invalid tenantId`))
      continue
    }
    const persistedTenantId = persisted.tenantId
    if (disposition === 'MAP' && persistedTenantId !== null && tenantId !== persistedTenantId) {
      rowErrors[index].push(makeError('STORE_TENANT_MISMATCH', 'tenantId', `store ${storeId} belongs to tenant ${persistedTenantId}`))
    }
  }

  for (const errors of rowErrors) {
    errors.sort(compareErrors)
  }

  const summary = {
    valid: rowErrors.every((errors) => errors.length === 0) && rows.length > 0,
    mapped: 0,
    quarantined: 0,
    global: 0,
    retired: 0,
    unresolved: 0,
    errors: [...artifactErrors]
  }

  for (const [index, errors] of rowErrors.entries()) {
    if (errors.length > 0) {
      summary.unresolved += 1
      summary.errors.push(...errors.map((error) => ({ ...error, rowIndex: index })))
      continue
    }
    const disposition = results[index].disposition
    const summaryKeys = {
      MAP: 'mapped',
      QUARANTINE: 'quarantined',
      GLOBAL: 'global',
      RETIRE: 'retired'
    }
    summary[summaryKeys[disposition]] += 1
  }

  summary.valid = summary.errors.length === 0 && rows.length > 0
  return summary
}

module.exports = {
  DISPOSITIONS,
  validateMappingRow,
  validateStoreMapping
}
