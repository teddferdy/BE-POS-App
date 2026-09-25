'use strict'

// AUTH-1 (DR-01/DR-03): explicit User ↔ Tenant membership. One user may
// belong to many tenants with a different role per tenant; exactly one role
// per membership (no stacking). Status vocabulary is DR-03: ACTIVE /
// DEACTIVATED / RETIRED. Only ACTIVE memberships authorize anything —
// deactivation preserves the role and subordinate store assignments (they go
// ineffective, they are not deleted), and rewrites no historical records.
const TARGET_ROLES = Object.freeze([
  'platform_admin',
  'tenant_admin',
  'store_admin',
  'cashier',
  'staff'
])

const MEMBERSHIP_STATUS = Object.freeze(['ACTIVE', 'DEACTIVATED', 'RETIRED'])

module.exports = (sequelize, DataTypes) => {
  const TenantMembership = sequelize.define(
    'tenantMembership',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'user', key: 'id' }
      },
      tenantId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'tenant', key: 'id' }
      },
      // Target DR-02 vocabulary. Validated app-side (STRING, not ENUM, so
      // the vocabulary can evolve without a type migration).
      role: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
          isIn: [TARGET_ROLES]
        }
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'ACTIVE',
        validate: {
          isIn: [MEMBERSHIP_STATUS]
        }
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'tenantMembership',
      tableName: 'tenant_membership',
      indexes: [
        {
          unique: true,
          name: 'uq_tenant_membership_user_tenant',
          fields: ['userId', 'tenantId']
        }
      ]
    }
  )

  TenantMembership.associate = (models) => {
    if (models.user) {
      TenantMembership.belongsTo(models.user, { foreignKey: 'userId', as: 'user' })
    }
    if (models.tenant) {
      TenantMembership.belongsTo(models.tenant, { foreignKey: 'tenantId', as: 'tenant' })
    }
  }

  return TenantMembership
}

module.exports.TARGET_ROLES = TARGET_ROLES
module.exports.MEMBERSHIP_STATUS = MEMBERSHIP_STATUS
