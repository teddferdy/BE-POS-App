const reportController = require('../api/controller/report')
const reportingController = require('../api/controller/reporting')

jest.mock('../api/service/reportDefs', () => ({
  daily: {
    getData: jest.fn(() => Promise.resolve({ rows: [{ a: 1 }], title: 'Laporan Harian', subtitle: 'x' }))
  },
  profitPerProduct: {
    getData: jest.fn(() => Promise.resolve({ rows: [{ b: 2 }], title: 'Laba per Produk', subtitle: 'x' }))
  },
  sales: { getData: jest.fn(() => Promise.resolve({ rows: [], title: '', subtitle: '' })) },
  cashFlow: { getData: jest.fn(() => Promise.resolve({ rows: [], title: '', subtitle: '' })) },
  bestSeller: { getData: jest.fn(() => Promise.resolve({ rows: [], title: '', subtitle: '' })) },
  productSales: { getData: jest.fn(() => Promise.resolve({ rows: [{ c: 3 }], title: '', subtitle: '' })) },
  categorySales: { getData: jest.fn(() => Promise.resolve({ rows: [], title: '', subtitle: '' })) },
  kasirPerformance: { getData: jest.fn(() => Promise.resolve({ rows: [], title: '', subtitle: '' })) }
}))

const mockRes = () => {
  const res = { json: jest.fn(), status: jest.fn(() => res) }
  return res
}

describe('report controllers delegate to reportDefs', () => {
  test('getDailyReport returns rows from daily.getData', async () => {
    const req = { query: {} }
    const res = mockRes()
    await reportController.getDailyReport(req, res)
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ a: 1 }] })
  })

  test('getProfitPerProduct returns rows from profitPerProduct.getData', async () => {
    const req = { query: {} }
    const res = mockRes()
    await reportController.getProfitPerProduct(req, res)
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ b: 2 }] })
  })

  test('reporting getProductSalesSummary returns rows', async () => {
    const req = { query: {} }
    const res = mockRes()
    await reportingController.getProductSalesSummary(req, res)
    expect(res.json).toHaveBeenCalled()
  })
})
