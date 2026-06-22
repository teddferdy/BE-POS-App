'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT table_name
          FROM information_schema.columns
          WHERE column_name = 'updatedAt'
            AND table_schema = 'public'
            AND is_nullable = 'NO'
        ) LOOP
          EXECUTE format('ALTER TABLE %I ALTER COLUMN "updatedAt" DROP NOT NULL', r.table_name);
        END LOOP;
      END $$;
    `)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT table_name
          FROM information_schema.columns
          WHERE column_name = 'updatedAt'
            AND table_schema = 'public'
            AND is_nullable = 'YES'
        ) LOOP
          EXECUTE format('ALTER TABLE %I ALTER COLUMN "updatedAt" SET NOT NULL', r.table_name);
        END LOOP;
      END $$;
    `)
  }
}
