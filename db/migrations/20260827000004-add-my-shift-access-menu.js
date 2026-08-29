module.exports = {
  up: async (queryInterface, Sequelize) => {
    const myShift = '[{"menu":"my-shift","read":true,"view":true}]'

    await queryInterface.sequelize.query(`
      UPDATE role
      SET "accessMenu" = COALESCE("accessMenu", '[]'::jsonb) || :myShift::jsonb,
          "updatedAt" = NOW()
      WHERE "accessMenu" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE("accessMenu", '[]'::jsonb)) j
          WHERE j->>'menu' = 'my-shift'
        )
    `, { replacements: { myShift } })

    await queryInterface.sequelize.query(`
      UPDATE "user"
      SET "accessMenu" = COALESCE("accessMenu", '[]'::jsonb) || :myShift::jsonb,
          "updatedAt" = NOW()
      WHERE "accessMenu" IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements("accessMenu") j
          WHERE j->>'menu' = 'shift'
        )
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements("accessMenu") j
          WHERE j->>'menu' = 'my-shift'
        )
    `, { replacements: { myShift } })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      UPDATE role
      SET "accessMenu" = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE("accessMenu", '[]'::jsonb)) elem
        WHERE elem->>'menu' != 'my-shift'
      ),
          "updatedAt" = NOW()
      WHERE "accessMenu" IS NOT NULL
    `)

    await queryInterface.sequelize.query(`
      UPDATE "user"
      SET "accessMenu" = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE("accessMenu", '[]'::jsonb)) elem
        WHERE elem->>'menu' != 'my-shift'
      ),
          "updatedAt" = NOW()
      WHERE "accessMenu" IS NOT NULL
    `)
  }
}