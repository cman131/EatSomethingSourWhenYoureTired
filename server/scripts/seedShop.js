const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ShopItem = require('../src/models/ShopItem');
const { SHOP_CATALOG } = require('../src/data/shopCatalog');

async function seedShop() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const catalogNames = SHOP_CATALOG.map(item => item.name);

  const deactivated = await ShopItem.updateMany(
    { name: { $nin: catalogNames } },
    { $set: { isActive: false } }
  );
  if (deactivated.modifiedCount > 0) {
    console.log(`Deactivated ${deactivated.modifiedCount} removed item(s)`);
  }

  let created = 0;
  let updated = 0;

  for (const { name, category, cost, tier, description, value, sortOrder } of SHOP_CATALOG) {
    const result = await ShopItem.findOneAndUpdate(
      { name },
      {
        $set: { cost, tier, description, value, sortOrder },
        $setOnInsert: { name, category, isActive: true },
      },
      { upsert: true, new: true, rawResult: true }
    );
    if (result.lastErrorObject?.upserted) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`Done: ${created} created, ${updated} updated`);
  await mongoose.disconnect();
}

seedShop().catch(err => {
  console.error(err);
  process.exit(1);
});
