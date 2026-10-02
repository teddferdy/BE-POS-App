'use strict'

// D-05 member identity canonicalization (locked business contract).
//
// Single canonical definition shared by application prechecks/lookups and the
// DB expression indexes created by the D-05 product-grade migration:
//   - name:  TRIM(name) + lowercase            (DB: LOWER(TRIM("name")))
//   - email: TRIM(email) + lowercase           (DB: LOWER(TRIM("email")))
//   - phone: E.164 via libphonenumber-js       (DB: stored canonical value)
//
// No NFKC/NFC Unicode compatibility normalization is applied anywhere.
// Hand-rolled country parsing is forbidden: all phone parsing goes through
// libphonenumber-js with default region ID for ambiguous national-form input.
// Inputs already in +<country-code> international form are parsed
// region-agnostically by the library.
//
// JS String.trim()/toLowerCase() vs SQL TRIM()/LOWER() can diverge on exotic
// whitespace. That divergence is accepted by design: the DB unique index is
// the final arbiter and maps violations to HTTP 409; the application precheck
// is UX/error-messaging only.
//
// All failures throw a plain Error with .statusCode, matching the existing
// semantic-error convention (utils/moneyGuard.js, validateCashTender).

const crypto = require('crypto')
const { parsePhoneNumberFromString, AsYouType } = require('libphonenumber-js')

const DEFAULT_REGION = 'ID'
const GUEST_PREFIX = 'GUEST-'

function assertString(value, field) {
  if (typeof value !== 'string') {
    const e = new Error(`${field} must be a string`)
    e.statusCode = 400
    throw e
  }
  return value
}

function canonicalName(name) {
  assertString(name, 'name')
  return name.trim().toLowerCase()
}

function canonicalEmail(email) {
  assertString(email, 'email')
  return email.trim().toLowerCase()
}

function canonicalPhone(phone, { region = DEFAULT_REGION } = {}) {
  assertString(phone, 'phoneNumber')
  const trimmed = phone.trim()
  let parsed = null
  try {
    parsed = parsePhoneNumberFromString(trimmed, region)
  } catch {
    parsed = null
  }
  if (!parsed || !parsed.isValid()) {
    const e = new Error('Nomor telepon tidak valid')
    e.statusCode = 400
    throw e
  }
  return parsed.format('E.164')
}

function formatNationalPhone(e164) {
  if (typeof e164 !== 'string' || e164 === '') return e164
  try {
    const parsed = parsePhoneNumberFromString(e164.trim(), DEFAULT_REGION)
    if (!parsed || !parsed.isValid()) return e164
    return parsed.format('NATIONAL')
  } catch {
    return e164
  }
}

function newGuestPhone() {
  return `${GUEST_PREFIX}${crypto.randomUUID()}`
}

function isGuestPhone(value) {
  return typeof value === 'string' && value.startsWith(GUEST_PREFIX)
}

function invalidPhoneError() {
  const e = new Error('Nomor telepon tidak valid')
  e.statusCode = 400
  return e
}

// Single classification of client-supplied member phone input, shared by the
// Zod boundary and the controller:
//   - absent / null / '' / whitespace-only -> { kind: 'missing' }
//   - GUEST-*                               -> { kind: 'guest', value }
//   - anything else                         -> { kind: 'phone', value: E.164 }
//                                              (throws 400 when unparseable)
// Guest identifiers are server-generated only; callers decide whether a
// supplied 'guest' value is acceptable (never on create; on update only when
// it equals the member's current value).
function parsePhoneInput(value) {
  if (value === undefined || value === null) return { kind: 'missing' }
  if (typeof value !== 'string') throw invalidPhoneError()
  if (value.trim() === '') return { kind: 'missing' }
  if (isGuestPhone(value)) return { kind: 'guest', value }
  return { kind: 'phone', value: canonicalPhone(value) }
}

// Admin phone search support: for phone-shaped input, returns the canonical
// E.164 prefix the library derives from the (possibly partial) digits, e.g.
// '0812' -> '+62812'. Returns null for non-phone-shaped input so arbitrary
// text is never run through phone parsing.
const PHONE_SEARCH_SHAPE = /^\+?[\d\s().-]+$/

function phoneSearchPrefix(term) {
  if (typeof term !== 'string') return null
  const trimmed = term.trim()
  if (!PHONE_SEARCH_SHAPE.test(trimmed) || !/\d/.test(trimmed)) return null
  try {
    const formatter = new AsYouType(DEFAULT_REGION)
    formatter.input(trimmed)
    return formatter.getNumberValue() || null
  } catch {
    return null
  }
}

module.exports = {
  DEFAULT_REGION,
  GUEST_PREFIX,
  canonicalName,
  canonicalEmail,
  canonicalPhone,
  formatNationalPhone,
  newGuestPhone,
  isGuestPhone,
  parsePhoneInput,
  phoneSearchPrefix
}
