const path = require('path');
const Sequelize = require('sequelize');
const config = require(path.join(__dirname, '..', 'config', 'config.js'));
const sequelize = new Sequelize(config.development);
async function run() {
  const [products] = await sequelize.query(`SELECT id, "nameProduct", sku, stock, price, "tipeProduk" FROM product WHERE "deletedAt" IS NULL ORDER BY id`);
  const [ingredients] = await sequelize.query(`SELECT id, name, stock, unit, "costPrice", status FROM ingredient WHERE "deletedAt" IS NULL ORDER BY id`);
  const [bomHeaders] = await sequelize.query(`SELECT id, "productId", name, status FROM bom_header WHERE "deletedAt" IS NULL ORDER BY id`);
  const [bomLines] = await sequelize.query(`SELECT id, "bomHeaderId", "ingredientId", qty, unit FROM bom_line WHERE "deletedAt" IS NULL ORDER BY id`);
  const [stores] = await sequelize.query(`SELECT id, name, status FROM location WHERE "deletedAt" IS NULL ORDER BY id`);
  const [users] = await sequelize.query(`SELECT id, "userName", "fullName", store FROM "user" WHERE "deletedAt" IS NULL LIMIT 5`);
  console.log('=== STORES ===');
  console.log(JSON.stringify(stores, null, 2));
  console.log('=== USERS ===');
  console.log(JSON.stringify(users, null, 2));
  console.log('=== PRODUCTS ===');
  console.log(JSON.stringify(products, null, 2));
  console.log('=== INGREDIENTS ===');
  console.log(JSON.stringify(ingredients, null, 2));
  console.log('=== BOM HEADERS ===');
  console.log(JSON.stringify(bomHeaders, null, 2));
  console.log('=== BOM LINES ===');
  console.log(JSON.stringify(bomLines, null, 2));
  await sequelize.close();
}
run().catch(e => { console.error(e); process.exit(1); });
