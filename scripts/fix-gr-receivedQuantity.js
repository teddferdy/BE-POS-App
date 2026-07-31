const path = require('path');
const Sequelize = require('sequelize');
const config = require(path.join(__dirname, '..', 'config', 'config.js'));
const sequelize = new Sequelize(config.development);

async function run() {
  console.log('Fixing orphaned GR items (purchaseOrderItem = null)...\n');

  // Find all GR items not linked to PO items, but have ingredientName
  const [orphans] = await sequelize.query(`
    SELECT
      gri.id AS "grItemId",
      gri."ingredientName",
      gri."qtyReceived",
      gr."purchaseOrderId"
    FROM goods_receipt_item gri
    JOIN goods_receipt gr ON gr.id = gri."goodsReceipt"
    WHERE gri."purchaseOrderItem" IS NULL
      AND gri."ingredientName" IS NOT NULL
      AND gr."deletedAt" IS NULL
      AND gri."deletedAt" IS NULL
    ORDER BY gr.id, gri.id
  `);

  if (orphans.length === 0) {
    console.log('No orphaned GR items found. All good!');
    await sequelize.close();
    return;
  }

  console.log(`Found ${orphans.length} orphaned GR item(s):\n`);

  let fixed = 0;
  for (const item of orphans) {
    // Find matching PO item by purchaseOrderId and ingredientName
    const [poItems] = await sequelize.query(
      `SELECT id, quantity, "receivedQuantity"
       FROM purchase_order_item
       WHERE "purchaseOrder" = $1
         AND "ingredientName" = $2
         AND "deletedAt" IS NULL
       LIMIT 1`,
      { bind: [item.purchaseOrderId, item.ingredientName] }
    );

    if (poItems.length === 0) {
      console.log(`  SKIP: No PO item found for "${item.ingredientName}" (PO #${item.purchaseOrderId})`);
      continue;
    }

    const poItem = poItems[0];
    const t = await sequelize.transaction();

    try {
      // 1. Link GR item to PO item
      await sequelize.query(
        `UPDATE goods_receipt_item SET "purchaseOrderItem" = $1 WHERE id = $2`,
        { bind: [poItem.id, item.grItemId], transaction: t }
      );

      // 2. Update PO item receivedQuantity
      await sequelize.query(
        `UPDATE purchase_order_item
         SET "receivedQuantity" = "receivedQuantity" + $1
         WHERE id = $2`,
        { bind: [item.qtyReceived, poItem.id], transaction: t }
      );

      await t.commit();
      console.log(`  FIXED: "${item.ingredientName}" → PO item #${poItem.id} (+${item.qtyReceived} to receivedQuantity)`);
      fixed++;
    } catch (err) {
      await t.rollback();
      console.error(`  FAILED: "${item.ingredientName}" – ${err.message}`);
    }
  }

  // Re-check PO statuses
  console.log('\nRe-checking PO statuses...');
  const [poIds] = await sequelize.query(`
    SELECT DISTINCT gr."purchaseOrderId"
    FROM goods_receipt_item gri
    JOIN goods_receipt gr ON gr.id = gri."goodsReceipt"
    WHERE gri."purchaseOrderItem" IS NOT NULL
      AND gr."deletedAt" IS NULL
  `);

  for (const row of poIds) {
    const [poItems] = await sequelize.query(
      `SELECT id, quantity, "receivedQuantity"
       FROM purchase_order_item
       WHERE "purchaseOrder" = $1 AND "deletedAt" IS NULL`,
      { bind: [row.purchaseOrderId] }
    );

    const allReceived = poItems.every(pi => Number(pi.receivedQuantity) >= Number(pi.quantity));
    const status = allReceived ? 'received' : 'ordered';

    await sequelize.query(
      `UPDATE purchase_order SET status = $1 WHERE id = $2`,
      { bind: [status, row.purchaseOrderId] }
    );
    console.log(`  PO #${row.purchaseOrderId} → status: ${status}`);
  }

  console.log(`\nDone! Fixed ${fixed} / ${orphans.length} orphaned GR items.`);
  await sequelize.close();
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
