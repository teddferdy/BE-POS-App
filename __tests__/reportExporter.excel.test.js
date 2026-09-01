const { buildExcelWorkbook } = require('../api/service/reportExporter/excel')

const spec = {
  title: 'Laporan Penjualan Harian',
  subtitle: '01 Sep 2026',
  brand: { name: 'Bisa Nota', address: 'Jl. Raya No.1', phoneNumber: '0812', email: 'h@b.id' },
  columns: [
    { key: 'tanggal', label: 'Tanggal', type: 'date', width: 14, align: 'left' },
    { key: 'totalSales', label: 'Total Penjualan', type: 'currency', width: 20, align: 'right' }
  ],
  rows: [
    { tanggal: '2026-09-01', totalSales: 1500000 },
    { tanggal: '2026-09-02', totalSales: 2000000 }
  ],
  totals: ['totalSales'],
  accentColor: '#0f172a'
}

describe('buildExcelWorkbook', () => {
  test('produces a workbook with one worksheet', async () => {
    const wb = await buildExcelWorkbook(spec)
    expect(wb.worksheets).toHaveLength(1)
  })

  test('writes brand name, title, header, data, and total rows', async () => {
    const wb = await buildExcelWorkbook(spec)
    const ws = wb.worksheets[0]
    const allText = ws.getCell(1, 1).value + ws.getCell(2, 1).value + ws.getCell(3, 1).value
    const cells = []
    ws.eachRow((row) => {
      row.eachCell((cell) => cells.push(String(cell.value ?? '')))
    })
    expect(cells).toContain('Bisa Nota')
    expect(cells).toContain('Laporan Penjualan Harian')
    expect(cells).toContain('Tanggal')
    expect(cells).toContain('Total Penjualan')
    expect(cells).toContain('Rp 1.500.000')
    expect(cells).toContain('Rp 2.000.000')
    expect(cells).toContain('Rp 3.500.000')
    expect(allText).toBeTruthy()
  })

  test('renders a header-only workbook when rows empty', async () => {
    const emptySpec = { ...spec, rows: [] }
    const wb = await buildExcelWorkbook(emptySpec)
    const ws = wb.worksheets[0]
    const cells = []
    ws.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value ?? ''))))
    expect(cells).toContain('Tanggal')
  })

  test('omits totals row when rows empty even if totals configured', async () => {
    const emptyWithTotals = { ...spec, rows: [], totals: ['totalSales'] }
    const wb = await buildExcelWorkbook(emptyWithTotals)
    const ws = wb.worksheets[0]
    const cells = []
    ws.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value ?? ''))))
    expect(cells).toContain('Tanggal')
    expect(cells).not.toContain('Total')
    expect(cells).not.toContain('Rp 0')
  })
})
