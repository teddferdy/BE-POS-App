const defs = {
  sales: require('../api/service/reportDefs/sales'),
  cashFlow: require('../api/service/reportDefs/cashFlow'),
  profitPerProduct: require('../api/service/reportDefs/profitPerProduct'),
  bestSeller: require('../api/service/reportDefs/bestSeller'),
  productSales: require('../api/service/reportDefs/productSales'),
  categorySales: require('../api/service/reportDefs/categorySales'),
  kasirPerformance: require('../api/service/reportDefs/kasirPerformance')
}

describe('reportDefs collection', () => {
  test.each(Object.keys(defs))('%s exposes the required shape', (key) => {
    const d = defs[key]
    expect(typeof d.getData).toBe('function')
    expect(Array.isArray(d.defaultColumns)).toBe(true)
    expect(d.defaultColumns.length).toBeGreaterThan(0)
    expect(Array.isArray(d.totals)).toBe(true)
    expect(typeof d.filename).toBe('function')
    expect(typeof d.label).toBe('string')
    expect(d.label.length).toBeGreaterThan(0)
    // every column has key/label/type/width/align
    d.defaultColumns.forEach((c) => {
      expect(c.key).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(['string', 'number', 'currency', 'date', 'percent']).toContain(c.type)
    })
  })
})
