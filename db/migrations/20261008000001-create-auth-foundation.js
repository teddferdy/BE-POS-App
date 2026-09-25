'use strict'

// AUTH-1 (DR-01/DR-02/DR-12 authorization foundation): explicit tenant,
// membership, and store-assignment tables plus nullable location.tenantId.
//
// SCHEMA ONLY — no data backfill. Existing stores/users stay valid without
// tenant assignment; inventing tenant ownership for production rows requires
// a business decision that is explicitly OUT of this migration (see the
// dev-only scripts/bootstrap-tenant-foundation.js strategy and the AUTH-1
// report). Additive and fully reversible.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tenant', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
      deletedAt: { allowNull: true, type: Sequelize.DATE }
    })

    await queryInterface.createTable('tenant_membership', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user', key: 'id' }
      },
      tenantId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenant', key: 'id' }
      },
      role: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
      deletedAt: { allowNull: true, type: Sequelize.DATE }
    })
    await queryInterface.addIndex('tenant_membership', {
      name: 'uq_tenant_membership_user_tenant',
      unique: true,
      fields: ['userId', 'tenantId']
    })
    await queryInterface.addIndex('tenant_membership', {
      name: 'ix_tenant_membership_tenant',
      fields: ['tenantId']
    })

    await queryInterface.createTable('store_assignment', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user', key: 'id' }
      },
      tenantId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenant', key: 'id' }
      },
      storeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'location', key: 'id' }
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    })
    await queryInterface.addIndex('store_assignment', {
      name: 'uq_store_assignment_user_store',
      unique: true,
      fields: ['userId', 'storeId']
    })
    await queryInterface.addIndex('store_assignment', {
      name: 'ix_store_assignment_tenant',
      fields: ['tenantId']
    })

    // Nullable first stage: existing location rows stay valid; tenant
    // ownership is assigned by explicit decision, never inferred here.
    await queryInterface.addColumn('location', 'tenantId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: 'tenant', key: 'id' }
    })
    await queryInterface.addIndex('location', {
      name: 'ix_location_tenant',
      fields: ['tenantId']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('location', 'ix_location_tenant')
    await queryInterface.removeColumn('location', 'tenantId')
    await queryInterface.removeIndex('store_assignment', 'ix_store_assignment_tenant')
    await queryInterface.removeIndex('store_assignment', 'uq_store_assignment_user_store')
    await queryInterface.dropTable('store_assignment')
    await queryInterface.removeIndex('tenant_membership', 'ix_tenant_membership_tenant')
    await queryInterface.removeIndex('tenant_membership', 'uq_tenant_membership_user_tenant')
    await queryInterface.dropTable('tenant_membership')
    await queryInterface.dropTable('tenant')
  }
}
