module.exports = {
  up: async (queryInterface) => {
    // The previous checkout code used an unlocked find-or-create against
    // best_selling, so concurrent checkouts of the same product/store could
    // each insert their own row. Merge any such duplicates (summing
    // totalSelling, keeping the lowest id) before the unique index below
    // would otherwise reject them.
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id, "productId", store,
               ROW_NUMBER() OVER (
                 PARTITION BY "productId", store
                 ORDER BY id ASC
               ) AS rn,
               SUM("totalSelling") OVER (PARTITION BY "productId", store) AS summed
        FROM best_selling
        WHERE "deletedAt" IS NULL
          AND "productId" IS NOT NULL
          AND store IS NOT NULL
      )
      UPDATE best_selling b
      SET "totalSelling" = ranked.summed
      FROM ranked
      WHERE b.id = ranked.id AND ranked.rn = 1
    `)

    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY "productId", store
                 ORDER BY id ASC
               ) AS rn
        FROM best_selling
        WHERE "deletedAt" IS NULL
          AND "productId" IS NOT NULL
          AND store IS NOT NULL
      )
      DELETE FROM best_selling b
      USING ranked
      WHERE b.id = ranked.id AND ranked.rn > 1
    `)

    // Partial unique index (paranoid soft-deletes keep old rows around, so
    // the constraint only needs to hold among live rows) — also lets the
    // checkout path use a single atomic ON CONFLICT upsert instead of a
    // findOne + conditional create/update race.
    await queryInterface.addIndex('best_selling', {
      name: 'best_selling_productId_store_unique',
      fields: ['productId', 'store'],
      unique: true,
      where: { deletedAt: null }
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex(
      'best_selling',
      'best_selling_productId_store_unique'
    )
  }
}
