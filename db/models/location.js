'use strict'
module.exports = (sequelize, DataTypes) => {
  const Location = sequelize.define(
    'location',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      // AUTH-1 (DR-01): tenant ownership. Nullable as a safe first stage so
      // existing rows stay valid without backfill; a store belongs to exactly
      // one tenant once assigned. Tenant ownership is authoritative persisted
      // state — never inferred from JWT. (Follow-up stage: NOT NULL after
      // production backfill decides real tenant boundaries.)
      tenantId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'tenant', key: 'id' }
      },
      image: {
        type: DataTypes.STRING
      },
      name: {
        type: DataTypes.STRING
      },
      address: {
        type: DataTypes.STRING
      },
      detailLocation: {
        type: DataTypes.STRING
      },
      city: {
        type: DataTypes.STRING
      },
      province: {
        type: DataTypes.STRING
      },
      district: {
        type: DataTypes.STRING
      },
      village: {
        type: DataTypes.STRING
      },
      postalCode: {
        type: DataTypes.STRING
      },
      latitude: {
        type: DataTypes.FLOAT
      },
      longitude: {
        type: DataTypes.FLOAT
      },
      mainBranch: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      description: {
        type: DataTypes.TEXT
      },
      openingHours: {
        type: DataTypes.JSONB
      },
      managerName: {
        type: DataTypes.STRING
      },
      email: {
        type: DataTypes.STRING
      },
      category: {
        type: DataTypes.STRING
      },
      phoneNumber: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      },
      socialMedia: {
        type: DataTypes.JSONB
      },
      dailyTarget: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      // Cash-out movements above this amount require approval before
      // becoming financially effective. Null means "use the built-in
      // default" (500000), applied in application code, not here.
      cashOutApprovalThreshold: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Absolute variance at register close within this amount auto-
      // approves; beyond it, a manager decision is required. Null means
      // "use the built-in default" (25000).
      cashVarianceThreshold: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Max concurrently-active parked carts for this store. Null means
      // "use the built-in default" (20), applied in application code.
      // 0/negative are treated as misconfiguration and also fall back to
      // the default — see api/controller/parkedCart.js.
      maxActiveParkedCarts: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Minutes a parked cart stays active before it is (lazily)
      // considered expired. Null means "use the built-in default" (120).
      parkedCartTtlMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Phase 22 Batch 3 — IANA timezone identifier (e.g. "Asia/Jakarta"),
      // authoritative for every business-date calculation scoped to this
      // store (due dates, H-4 classification, ...). NOT a fixed UTC
      // offset and NOT "WIB"/"WITA"/"WIT" — see utils/businessDate.js.
      timezone: {
        type: DataTypes.STRING(50),
        defaultValue: 'Asia/Jakarta'
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'location',
      tableName: 'location'
    }
  )

  Location.associate = (models) => {
    // AUTH-1 (DR-01): store → tenant ownership.
    if (models.tenant) {
      Location.belongsTo(models.tenant, { foreignKey: 'tenantId', as: 'tenant' })
    }
  }

  return Location
}
