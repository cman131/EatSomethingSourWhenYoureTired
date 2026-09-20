const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ShopItem = require('../src/models/ShopItem');

const SEED_ITEMS = [
  // nameColor — 8 items
  { name: 'Sakura Pink',    description: 'Delicate cherry blossom pink',                 category: 'nameColor',     cost: 100, tier: 'entry',   value: 'flair-color-pink',    sortOrder: 1 },
  { name: 'Sea Teal',       description: 'Inspired by the East China Sea',                category: 'nameColor',     cost: 100, tier: 'entry',   value: 'flair-color-teal',    sortOrder: 2 },
  { name: 'Amber',          description: 'Warm amber glow',                               category: 'nameColor',     cost: 150, tier: 'entry',   value: 'flair-color-amber',   sortOrder: 3 },
  { name: 'Jade Green',     description: 'Classic jade green',                            category: 'nameColor',     cost: 250, tier: 'mid',     value: 'flair-color-emerald', sortOrder: 4 },
  { name: 'Ocean Blue',     description: 'A deep ocean blue',                             category: 'nameColor',     cost: 250, tier: 'mid',     value: 'flair-color-blue',    sortOrder: 5 },
  { name: 'Royal Purple',   description: 'Regal and commanding',                          category: 'nameColor',     cost: 300, tier: 'mid',     value: 'flair-color-purple',  sortOrder: 6 },
  { name: 'Crimson Dragon', description: 'The fierce red of a dragon',                    category: 'nameColor',     cost: 600, tier: 'premium', value: 'flair-color-red',     sortOrder: 7 },
  { name: 'Mahjong Gold',   description: 'The golden color of a winning hand',            category: 'nameColor',     cost: 700, tier: 'premium', value: 'flair-color-gold',    sortOrder: 8 },

  // nameIcon — 8 items
  { name: 'Cherry Blossom', description: 'A delicate sakura bloom',                       category: 'nameIcon',      cost: 100, tier: 'entry',   value: '🌸', sortOrder: 1 },
  { name: 'Bamboo',         description: 'A lucky bamboo stalk',                          category: 'nameIcon',      cost: 100, tier: 'entry',   value: '🎋', sortOrder: 2 },
  { name: 'Lucky Star',     description: 'For lucky players',                             category: 'nameIcon',      cost: 150, tier: 'entry',   value: '⭐', sortOrder: 3 },
  { name: 'Red Lantern',    description: 'A traditional festival lantern',                category: 'nameIcon',      cost: 200, tier: 'mid',     value: '🏮', sortOrder: 4 },
  { name: 'Mahjong Tile',   description: 'The iconic mahjong tile',                       category: 'nameIcon',      cost: 250, tier: 'mid',     value: '🀄', sortOrder: 5 },
  { name: 'Dragon',         description: 'A fearsome dragon',                             category: 'nameIcon',      cost: 300, tier: 'mid',     value: '🐉', sortOrder: 6 },
  { name: 'Flame',          description: 'You are on fire',                               category: 'nameIcon',      cost: 500, tier: 'premium', value: '🔥', sortOrder: 7 },
  { name: 'Crown',          description: 'Royalty at the table',                          category: 'nameIcon',      cost: 600, tier: 'premium', value: '👑', sortOrder: 8 },

  // profileBorder — 7 items
  { name: 'Blush',          description: 'A soft pink ring',                              category: 'profileBorder', cost: 100, tier: 'entry',   value: 'flair-ring-blush',  sortOrder: 1 },
  { name: 'Pebble',         description: 'A simple stone-grey ring',                      category: 'profileBorder', cost: 100, tier: 'entry',   value: 'flair-ring-pebble', sortOrder: 2 },
  { name: 'Jade Ring',      description: 'Rich jade border',                              category: 'profileBorder', cost: 250, tier: 'mid',     value: 'flair-ring-jade',   sortOrder: 3 },
  { name: 'Cobalt Ring',    description: 'Deep cobalt border',                            category: 'profileBorder', cost: 250, tier: 'mid',     value: 'flair-ring-cobalt', sortOrder: 4 },
  { name: 'Sakura Ring',    description: 'Cherry blossom pink border',                    category: 'profileBorder', cost: 300, tier: 'mid',     value: 'flair-ring-sakura', sortOrder: 5 },
  { name: 'Rainbow Halo',   description: 'Slowly spinning rainbow conic gradient',        category: 'profileBorder', cost: 600, tier: 'premium', value: 'flair-border-rainbow',    sortOrder: 6 },
  { name: 'Dragon Scale',   description: 'Spinning emerald gradient — shimmering scales', category: 'profileBorder', cost: 700, tier: 'premium', value: 'flair-border-dragon',     sortOrder: 7 },

  // title — 7 items
  { name: 'Regular',        description: 'A familiar face at the table',                  category: 'title',         cost: 100, tier: 'entry',   value: 'Regular',        sortOrder: 1 },
  { name: 'Tenpai',         description: 'Always one tile away from winning',             category: 'title',         cost: 150, tier: 'entry',   value: 'Tenpai',         sortOrder: 2 },
  { name: 'East Wind',      description: "The dealer's seat — a position of prestige",    category: 'title',         cost: 250, tier: 'mid',     value: 'East Wind',      sortOrder: 3 },
  { name: 'Dragon Slayer',  description: 'Defeated more than a few big hands',            category: 'title',         cost: 300, tier: 'mid',     value: 'Dragon Slayer',  sortOrder: 4 },
  { name: 'Dora Hunter',    description: 'Always chasing bonus tiles',                    category: 'title',         cost: 350, tier: 'mid',     value: 'Dora Hunter',    sortOrder: 5 },
  { name: 'Chicken Farmer', description: "Wins without a single yaku. Honkaku's nemesis.", category: 'title',        cost: 600, tier: 'premium', value: 'Chicken Farmer', sortOrder: 6 },
  { name: 'Chombo Chaser',  description: 'A dedicated student of the penalty sheet.',     category: 'title',         cost: 700, tier: 'premium', value: 'Chombo Chaser',  sortOrder: 7 },
];

async function seedShop() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const catalogNames = SEED_ITEMS.map(item => item.name);

  const deactivated = await ShopItem.updateMany(
    { name: { $nin: catalogNames } },
    { $set: { isActive: false } }
  );
  if (deactivated.modifiedCount > 0) {
    console.log(`Deactivated ${deactivated.modifiedCount} removed item(s)`);
  }

  let created = 0;
  let updated = 0;

  for (const { name, category, cost, tier, description, value, sortOrder } of SEED_ITEMS) {
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
