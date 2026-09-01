const { renderCsv } = require('../api/service/reportExporter/csv')

const spec = {
  columns: [
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
    { key: 'totalSales', label: 'Total Penjualan', type: 'currency' },
    { key: 'note', label: 'Catatan', type: 'string' }
  ],
  rows: [
    { tanggal: '2026-09-01', totalSales: 1500000, note: 'ok' },
    { tanggal: '2026-09-02', totalSales: 0, note: 'a,b"c' }
  ],
  totals: ['totalSales']
}

describe('renderCsv', () => {
  test('starts with UTF-8 BOM and uses CRLF', () => {
    const csv = renderCsv(spec)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('\r\n')
  })

  test('writes header labels then formatted data rows', () => {
    const csv = renderCsv(spec)
    expect(csv).toContain('Tanggal,Total Penjualan,Catatan')
    expect(csv).toContain('01 Sep 2026,Rp 1.500.000,ok')
    expect(csv).toContain('02 Sep 2026,Rp 0,"a,b""c"')
  })

  test('appends a totals row for configured keys', () => {
    const csv = renderCsv(spec)
    expect(csv).toContain('Total,Rp 1.500.000,')
  })

  test('quotes cells containing comma, quote, or newline', () => {
    const csv = renderCsv(spec)
    expect(csv).toContain('"a,b""c"')
  })

  test('empty rows produce header only, no totals row', () => {
    const csv = renderCsv({ columns: spec.columns, rows: [], totals: spec.totals })
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe('Tanggal,Total Penjualan,Catatan')
    expect(csv).not.toContain('\r\nTotal')
  })
})
