const {
  formatValue,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDate
} = require('../api/service/reportExporter/formatters')

describe('reportExporter formatters', () => {
  test('formatNumber uses id-ID grouping', () => {
    expect(formatNumber(1234567)).toBe('1.234.567')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(null)).toBe('0')
  })

  test('formatCurrency prefixes Rp and uses id-ID grouping', () => {
    expect(formatCurrency(1500000)).toBe('Rp 1.500.000')
    expect(formatCurrency(0)).toBe('Rp 0')
    expect(formatCurrency(null)).toBe('Rp 0')
  })

  test('formatPercent accepts fraction or whole-number percent', () => {
    expect(formatPercent(0.34)).toBe('34%')
    expect(formatPercent(34)).toBe('34%')
    expect(formatPercent(null)).toBe('0%')
  })

  test('formatDate renders dd MMM yyyy in English month', () => {
    expect(formatDate('2026-09-01')).toBe('01 Sep 2026')
    expect(formatDate(new Date('2026-09-01T00:00:00'))).toBe('01 Sep 2026')
    expect(formatDate(null)).toBe('')
  })

  test('formatValue dispatches by type and falls back to string', () => {
    expect(formatValue(1500000, 'currency')).toBe('Rp 1.500.000')
    expect(formatValue(1234567, 'number')).toBe('1.234.567')
    expect(formatValue('2026-09-01', 'date')).toBe('01 Sep 2026')
    expect(formatValue(0.34, 'percent')).toBe('34%')
    expect(formatValue('plain text', 'string')).toBe('plain text')
    expect(formatValue(42, 'unknown')).toBe('42')
    expect(formatValue(null, 'string')).toBe('')
  })
})
