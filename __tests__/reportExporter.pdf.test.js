const { PassThrough } = require('stream')
const { renderPdf } = require('../api/service/reportExporter/pdf')

const collect = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })

const spec = {
  title: 'Laporan Penjualan Harian',
  subtitle: '01 Sep 2026',
  brand: { name: 'Bisa Nota', address: 'Jl. Raya No.1', city: 'Bandung', phoneNumber: '0812', email: 'h@b.id' },
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

describe('renderPdf', () => {
  test('produces a valid PDF stream to the response-like stream', async () => {
    const sink = new PassThrough()
    const promise = renderPdf(spec, sink)
    const buf = await collect(sink)
    await promise
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.toString()).toContain('%%EOF')
    expect(buf.length).toBeGreaterThan(1000)
  })

  test('renders a valid PDF even with no rows', async () => {
    const emptySpec = { ...spec, rows: [] }
    const sink = new PassThrough()
    const promise = renderPdf(emptySpec, sink)
    const buf = await collect(sink)
    await promise
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
