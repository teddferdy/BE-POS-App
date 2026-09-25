'use strict'

// AUTH-1 (DR-01/DR-03): explicit User ↔ Store assignment inside a tenant.
// Tenant-consistency (assignment.tenantId === store.tenantId) is enforced in
// a model hook — a user can never be assigned to a store outside the
// membership tenant, regardless of what IDs a caller supplies. Assignments
// are preserved (not deleted) when the membership is deactivated; they go
// ineffective via the membership status check in utils/authContext.js.
// Revocation of an assignment itself is a hard delete (paranoid:false) so a
// later re-assignment never collides with a soft-deleted row.
module.exports = (sequelize, DataTypes) => {
  const StoreAssignment = sequelize.define(
    'storeAssignment',
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
      storeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'location', key: 'id' }
      }
    },
    {
      paranoid: false,
      freezeTableName: true,
      modelName: 'storeAssignment',
      tableName: 'store_assignment',
      indexes: [
        {
          unique: true,
          name: 'uq_store_assignment_user_store',
          fields: ['userId', 'storeId']
        },
        {
          name: 'ix_store_assignment_tenant',
          fields: ['tenantId']
        }
      ]
    }
  )

  StoreAssignment.associate = (models) => {
    if (models.user) {
      StoreAssignment.belongsTo(models.user, { foreignKey: 'userId', as: 'user' })
    }
    if (models.tenant) {
      StoreAssignment.belongsTo(models.tenant, { foreignKey: 'tenantId', as: 'tenant' })
    }
    if (models.location) {
      StoreAssignment.belongsTo(models.location, { foreignKey: 'storeId', as: 'store' })
    }
  }

  // Tenant-consistency guard: runs on create AND update so neither path can
  // persist a cross-tenant assignment. Throws a deterministic error carrying
  // IDs only (no payload, no SQL).
  const assertTenantConsistent = async (instance) => {
    if (instance.storeId == null || instance.tenantId == null) return
    const location = await instance.constructor.sequelize.models.location?.findByPk(instance.storeId, {
      attributes: ['id', 'tenantId']
    })
    if (!location) {
      throw new Error('storeAssignment rejected: store does not exist')
    }
    if (location.tenantId == null || Number(location.tenantId) !== Number(instance.tenantId)) {
      throw new Error('storeAssignment rejected: store does not belong to tenant')
    }
  }

  StoreAssignment.addHook('beforeCreate', assertTenantConsistent)
  StoreAssignment.addHook('beforeUpdate', assertTenantConsistent)

  return StoreAssignment
}
