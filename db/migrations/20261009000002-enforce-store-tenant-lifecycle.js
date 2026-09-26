'use strict'

// AUTH-2: store/product tenant lifecycle support objects.
//
// SCHEMA ONLY — indexes that the enforced rules in
// api/validation/schemas.js (assertOperationalStoreTenant) and
// db/models/product_store.js (assertTenantConsistentAssignment) query on
// every lifecycle decision. There is deliberately NO backfill, NO data
// statement, and NO NOT NULL here: location.tenantId stays nullable until an
// approved backfill has completed and the production cutover gate is
// authorized. Nothing in this migration executes automatically.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addIndex('location', {
      name: 'ix_location_tenant_status',
      fields: ['tenantId', 'status']
    })
    await queryInterface.addIndex('product_store', {
      name: 'ix_product_store_store',
      fields: ['store']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('product_store', 'ix_product_store_store')
    await queryInterface.removeIndex('location', 'ix_location_tenant_status')
  }
}
