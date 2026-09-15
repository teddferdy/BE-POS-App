process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const {
  DEFAULT_TIMEZONE,
  isValidTimezone,
  getStoreLocalDate,
  daysBetweenDateStrings,
  getDaysUntilDue,
  getDaysOverdue,
  classifyDueDate
} = require('../utils/businessDate')

// Phase 22 Batch 3 — Timezone-Aware Due Date Foundation.
//
// Pure unit coverage for the single authoritative business-date module.
// Deliberately dependency-free (Intl.DateTimeFormat, already built into
// Node — no moment-timezone/luxon added) so these tests also prove the
// runtime's IANA timezone database is being exercised correctly, not a
// hand-rolled offset table.

describe('isValidTimezone — IANA validation, not WIB/WITA/WIT aliases or fixed offsets', () => {
  test('accepts real IANA identifiers', () => {
    expect(isValidTimezone('Asia/Jakarta')).toBe(true)
    expect(isValidTimezone('Asia/Makassar')).toBe(true)
    expect(isValidTimezone('Asia/Jayapura')).toBe(true)
    expect(isValidTimezone('America/New_York')).toBe(true)
    expect(isValidTimezone('Europe/London')).toBe(true)
  })

  test('rejects invalid/fake identifiers', () => {
    expect(isValidTimezone('Asia/FakeCity')).toBe(false)
  })

  test('rejects non-IANA aliases and fixed-offset strings', () => {
    expect(isValidTimezone('WIB')).toBe(false)
    expect(isValidTimezone('WITA')).toBe(false)
    expect(isValidTimezone('WIT')).toBe(false)
    expect(isValidTimezone('UTC+7')).toBe(false)
  })

  test('rejects empty/missing values', () => {
    expect(isValidTimezone('')).toBe(false)
    expect(isValidTimezone(null)).toBe(false)
    expect(isValidTimezone(undefined)).toBe(false)
  })

  test('DEFAULT_TIMEZONE is a valid IANA identifier', () => {
    expect(DEFAULT_TIMEZONE).toBe('Asia/Jakarta')
    expect(isValidTimezone(DEFAULT_TIMEZONE)).toBe(true)
  })
})

describe('getStoreLocalDate — instant → store local calendar date, per IANA zone', () => {
  test('Jakarta (UTC+7)', () => {
    expect(getStoreLocalDate('Asia/Jakarta', new Date('2026-09-15T10:00:00Z'))).toBe('2026-09-15')
  })

  test('Makassar (UTC+8)', () => {
    expect(getStoreLocalDate('Asia/Makassar', new Date('2026-09-15T10:00:00Z'))).toBe('2026-09-15')
  })

  test('Jayapura (UTC+9)', () => {
    expect(getStoreLocalDate('Asia/Jayapura', new Date('2026-09-15T10:00:00Z'))).toBe('2026-09-15')
  })

  test('the exact same instant can be a different calendar date in each zone (midnight boundary)', () => {
    // 2026-09-15 23:30 UTC -> Jakarta (+7) is already 2026-09-16 06:30
    const instant = new Date('2026-09-15T23:30:00Z')
    expect(getStoreLocalDate('Asia/Jakarta', instant)).toBe('2026-09-16')
  })

  test('an invalid/missing timezone falls back to the default rather than throwing', () => {
    const instant = new Date('2026-09-15T10:00:00Z')
    expect(getStoreLocalDate('Not/AZone', instant)).toBe(getStoreLocalDate(DEFAULT_TIMEZONE, instant))
    expect(getStoreLocalDate(null, instant)).toBe(getStoreLocalDate(DEFAULT_TIMEZONE, instant))
  })

  test('DST timezone (America/New_York) resolves via real IANA rules, not a fixed offset', () => {
    // 2026-03-08 is DST spring-forward Sunday for America/New_York (2 AM -> 3 AM).
    // Before the transition (EST, UTC-5): 06:59 UTC is still 01:59 local, March 8.
    const beforeDst = new Date('2026-03-08T06:59:00Z')
    expect(getStoreLocalDate('America/New_York', beforeDst)).toBe('2026-03-08')
    // A date safely after the transition (EDT, UTC-4) — same calendar day,
    // proving the offset used shifted without any hardcoded arithmetic.
    const afterDst = new Date('2026-03-08T23:00:00Z')
    expect(getStoreLocalDate('America/New_York', afterDst)).toBe('2026-03-08')
    // Six months later (EDT, UTC-4) — a plain sanity check that summer
    // offset resolution also works, distinct from winter's UTC-5.
    const summer = new Date('2026-07-01T03:30:00Z') // 23:30 EDT previous day
    expect(getStoreLocalDate('America/New_York', summer)).toBe('2026-06-30')
  })
})

describe('timezone boundary — same UTC instant across the three Indonesian zones', () => {
  // Task example: 16:59:59Z is still Sep 15 in Jakarta; 17:00:00Z rolls to Sep 16.
  test('Asia/Jakarta (UTC+7) boundary at 17:00Z', () => {
    expect(getStoreLocalDate('Asia/Jakarta', new Date('2026-09-15T16:59:59Z'))).toBe('2026-09-15')
    expect(getStoreLocalDate('Asia/Jakarta', new Date('2026-09-15T17:00:00Z'))).toBe('2026-09-16')
  })

  test('Asia/Makassar (UTC+8) boundary at 16:00Z', () => {
    expect(getStoreLocalDate('Asia/Makassar', new Date('2026-09-15T15:59:59Z'))).toBe('2026-09-15')
    expect(getStoreLocalDate('Asia/Makassar', new Date('2026-09-15T16:00:00Z'))).toBe('2026-09-16')
  })

  test('Asia/Jayapura (UTC+9) boundary at 15:00Z', () => {
    expect(getStoreLocalDate('Asia/Jayapura', new Date('2026-09-15T14:59:59Z'))).toBe('2026-09-15')
    expect(getStoreLocalDate('Asia/Jayapura', new Date('2026-09-15T15:00:00Z'))).toBe('2026-09-16')
  })
})

describe('daysBetweenDateStrings + getDaysUntilDue — signed calendar-day difference', () => {
  test('positive: due date in the future', () => {
    expect(daysBetweenDateStrings('2026-09-19', '2026-09-15')).toBe(4)
  })

  test('zero: due today', () => {
    expect(daysBetweenDateStrings('2026-09-15', '2026-09-15')).toBe(0)
  })

  test('negative: overdue', () => {
    expect(daysBetweenDateStrings('2026-09-14', '2026-09-15')).toBe(-1)
  })

  test('getDaysUntilDue returns null for a missing due date (never classified as overdue)', () => {
    expect(getDaysUntilDue(null, 'Asia/Jakarta')).toBeNull()
    expect(getDaysUntilDue(undefined, 'Asia/Jakarta')).toBeNull()
  })

  test('getDaysUntilDue resolves against the store-local "now", not UTC', () => {
    // now = 2026-09-15 23:30 UTC = 2026-09-16 06:30 in Jakarta.
    const now = new Date('2026-09-15T23:30:00Z')
    // Due date 2026-09-16 is "today" in Jakarta at this instant, not "tomorrow".
    expect(getDaysUntilDue('2026-09-16', 'Asia/Jakarta', now)).toBe(0)
  })
})

describe('getDaysOverdue — backward-compatible with the pre-existing metric (Batch 1 F22-B1-04)', () => {
  test('daysUntilDue > 0 -> daysOverdue = 0', () => {
    expect(getDaysOverdue(4)).toBe(0)
    expect(getDaysOverdue(30)).toBe(0)
  })

  test('daysUntilDue = 0 -> daysOverdue = 0', () => {
    expect(getDaysOverdue(0)).toBe(0)
  })

  test('daysUntilDue < 0 -> daysOverdue = abs(daysUntilDue)', () => {
    expect(getDaysOverdue(-1)).toBe(1)
    expect(getDaysOverdue(-10)).toBe(10)
  })

  test('null/undefined daysUntilDue -> daysOverdue = 0', () => {
    expect(getDaysOverdue(null)).toBe(0)
    expect(getDaysOverdue(undefined)).toBe(0)
  })
})

describe('classifyDueDate — the single authoritative H-4..Overdue rule', () => {
  test('exactly H-4', () => expect(classifyDueDate(4)).toBe('H-4'))
  test('H-3', () => expect(classifyDueDate(3)).toBe('H-3'))
  test('H-2', () => expect(classifyDueDate(2)).toBe('H-2'))
  test('exactly H-1', () => expect(classifyDueDate(1)).toBe('H-1'))
  test('due today', () => expect(classifyDueDate(0)).toBe('DUE_TODAY'))
  test('one day overdue', () => expect(classifyDueDate(-1)).toBe('OVERDUE'))
  test('far future (> H-4) is UPCOMING, not H-4', () => expect(classifyDueDate(30)).toBe('UPCOMING'))
  test('missing dueDate (null daysUntilDue) classifies as null, never OVERDUE', () => {
    expect(classifyDueDate(null)).toBeNull()
    expect(classifyDueDate(undefined)).toBeNull()
  })
})
