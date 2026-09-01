const db = require('../db/models')
const daily = require('../api/service/reportDefs/daily')

jest.mock('../db/models')

describe('reportDefs.daily', () => {
  test('exposes defaultColumns, totals, label, filename', () => {
    expect(daily.defaultColumns.length).toBeGreaterThan(0)
    expect(daily.totals).toContain('totalPenjualanBersih')
    expect(daily.label).toBe('Laporan Harian')
    expect(daily.filename()).toBe('laporan-harian')
  })
})
