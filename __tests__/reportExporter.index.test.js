const { PassThrough } = require('stream')
const { exportReport, getContentType, getExtension } = require('../api/service/reportExporter')

const spec = {
  title: 'T',
  columns: [{ key: 'a', label: 'A', type: 'string' }],
  rows: [{ a: 'x' }]
}

const makeRes = () => {
  const res = new PassThrough()
  res.setHeader = (k, v) => { res.headers = res.headers || {}; res.headers[k] = v }
  res.status = (n) => { res.code = n; return res }
  res.end = res.end.bind(res)
  return res
}

describe('getExtension / getContentType', () => {
  test('maps formats to extensions', () => {
    expect(getExtension('excel')).toBe('.xlsx')
    expect(getExtension('pdf')).toBe('.pdf')
    expect(getExtension('csv')).toBe('.csv')
  })
  test('maps formats to content types', () => {
    expect(getContentType('excel')).toContain('spreadsheetml')
    expect(getContentType('pdf')).toBe('application/pdf')
    expect(getContentType('csv')).toContain('text/csv')
  })
})

describe('exportReport', () => {
  test('csv sets header and writes body', async () => {
    const res = makeRes()
    const promise = exportReport({ format: 'csv', spec, filename: 'laporan.csv', res })
    const chunks = []
    for await (const c of res) chunks.push(c)
    await promise
    const body = Buffer.concat(chunks).toString()
    expect(res.headers['Content-Type']).toContain('text/csv')
    expect(res.headers['Content-Disposition']).toContain('laporan.csv')
    expect(body).toContain('A')
    expect(body).toContain('x')
  })
})
