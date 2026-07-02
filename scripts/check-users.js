const Sequelize = require('sequelize');
const config = require('/Users/teddyferdianabraramrullah/fullstack-dev/POS-APP/BE-POS-App/config/config.js');
const sequelize = new Sequelize(config.development);

async function run() {
  // Check users with their roles
  const [users] = await sequelize.query(`
    SELECT u.id, u."userName", u."fullName", u."roleType", u.store, u.password
    FROM "user" u
    WHERE u."deletedAt" IS NULL AND u.status = 'active'
    ORDER BY u.id
  `);
  console.log('=== USERS ===');
  for (const u of users) {
    console.log(`  [${u.id}] ${u.userName} / ${u.fullName} | role:${u.roleType} | store:${u.store} | pwd:${(u.password || '').slice(0, 20)}...`);
  }

  // Check categories
  const [cats] = await sequelize.query(`SELECT id, name, store FROM category WHERE "deletedAt" IS NULL AND status = 'active' LIMIT 20`);
  console.log('\n=== CATEGORIES ===');
  cats.forEach(c => console.log(`  [${c.id}] ${c.name} store:${c.store}`));

  // Check product_store_stock for store 13
  const [pss] = await sequelize.query(`
    SELECT pss.product, p."nameProduct", pss.stock, pss.store
    FROM product_store_stock pss
    JOIN product p ON p.id = pss.product
    WHERE pss.store = 13
  `);
  console.log('\n=== PRODUCT STORE STOCK (store 13) ===');
  pss.forEach(ps => console.log(`  ${ps.nameProduct}: stock=${ps.stock}`));

  await sequelize.close();
}
run().catch(e => { console.error(e); process.exit(1); });
