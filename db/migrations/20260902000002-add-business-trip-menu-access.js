'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const superAdminMenu = JSON.stringify({
      menu: 'business-trip',
      create: true,
      read: true,
      update: true,
      delete: true,
      download: true,
      upload: true
    })

    const adminMenu = JSON.stringify({
      menu: 'business-trip',
      read: true,
      create: true,
      update: true,
      delete: true
    })

    await queryInterface.sequelize.query(
      `UPDATE role
       SET "accessMenu" = COALESCE("accessMenu", '[]'::jsonb) || :menu::jsonb,
           "updatedAt" = NOW()
       WHERE "roleType" = 'super_admin'
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(COALESCE("accessMenu", '[]'::jsonb))
           WHERE value->>'menu' = 'business-trip'
         )`,
      { replacements: { menu: superAdminMenu } }
    )

    await queryInterface.sequelize.query(
      `UPDATE role
       SET "accessMenu" = COALESCE("accessMenu", '[]'::jsonb) || :menu::jsonb,
           "updatedAt" = NOW()
       WHERE "roleType" = 'admin'
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(COALESCE("accessMenu", '[]'::jsonb))
           WHERE value->>'menu' = 'business-trip'
         )`,
      { replacements: { menu: adminMenu } }
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE role
       SET "accessMenu" = (
         SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE("accessMenu", '[]'::jsonb)) item
         WHERE item->>'menu' <> 'business-trip'
       ),
       "updatedAt" = NOW()
       WHERE "roleType" IN ('super_admin', 'admin')`
    )
  }
}
