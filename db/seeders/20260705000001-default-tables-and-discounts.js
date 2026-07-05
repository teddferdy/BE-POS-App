'use strict'

const stores = [
  { id: 1, name: 'Lawson', tables: 20 },
  { id: 2, name: 'family mart', tables: 18 }
]

const discounts = [
  // global — all stores
  { store: null, name: 'Early Bird', type: 'percent', value: 10, minimumOrder: 0, maximumDiscount: 20000, code: 'EARLY10', conditions: { days: ['monday','tuesday','wednesday','thursday','friday'], maxHour: 10 } },
  { store: null, name: 'Happy Hour', type: 'percent', value: 15, minimumOrder: 0, maximumDiscount: 30000, code: 'HAPPY15', conditions: { days: ['monday','tuesday','wednesday','thursday','friday'], minHour: 14, maxHour: 17 } },
  { store: null, name: 'Member Discount', type: 'percent', value: 5, minimumOrder: 0, maximumDiscount: 15000, code: 'MEMBER5', conditions: { memberOnly: true } },
  { store: null, name: 'Weekend Special', type: 'percent', value: 7, minimumOrder: 50000, maximumDiscount: 25000, code: 'WEEKEND7', conditions: { days: ['saturday','sunday'] } },
  { store: null, name: 'Bundle Hemat', type: 'nominal', value: 20000, minimumOrder: 100000, maximumDiscount: 20000, code: 'BUNDLE20', conditions: null },
  { store: null, name: 'Grand Opening', type: 'percent', value: 20, minimumOrder: 0, maximumDiscount: 50000, code: 'GRAND20', conditions: null },
  { store: null, name: 'Payday Treat', type: 'nominal', value: 10000, minimumOrder: 75000, maximumDiscount: 10000, code: 'PAYDAY10', conditions: { days: ['25','26','27'] } },
  // Lawson only
  { store: 1, name: 'Lawson Night Owl', type: 'percent', value: 10, minimumOrder: 0, maximumDiscount: 15000, code: 'LW_NIGHT', conditions: { minHour: 20 } },
  { store: 1, name: 'Lawson Coffee Break', type: 'nominal', value: 5000, minimumOrder: 25000, maximumDiscount: 5000, code: 'LW_COFFEE', conditions: { minHour: 13, maxHour: 16 } },
  // family mart only
  { store: 2, name: 'FM Student', type: 'percent', value: 10, minimumOrder: 0, maximumDiscount: 10000, code: 'FM_STUDENT', conditions: null },
  { store: 2, name: 'FM Kopi Nikmat', type: 'nominal', value: 3000, minimumOrder: 15000, maximumDiscount: 3000, code: 'FM_KOPI', conditions: null }
]

async function seedTable(queryInterface, storeId, count) {
  const rows = []
  for (let i = 1; i <= count; i++) {
    const cap = i <= 4 ? 2 : i <= 12 ? 4 : 6
    rows.push({ store: storeId, name: `Meja ${i}`, capacity: cap, status: 'available', createdBy: 1, modifiedBy: 1, createdAt: new Date(), updatedAt: new Date() })
  }
  await queryInterface.bulkInsert('table', rows, {})
}

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const s of stores) {
      await seedTable(queryInterface, s.id, s.tables)
    }
    const discountRows = discounts.map((d) => ({
      store: d.store, name: d.name, type: d.type, value: d.value,
      minimumOrder: d.minimumOrder, maximumDiscount: d.maximumDiscount,
      code: d.code, conditions: d.conditions ? JSON.stringify(d.conditions) : null,
      status: 'active', createdBy: 1, modifiedBy: 1,
      createdAt: new Date(), updatedAt: new Date()
    }))
    await queryInterface.bulkInsert('discount', discountRows, {})
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('discount', null, {})
    await queryInterface.bulkDelete('table', null, {})
  }
}
