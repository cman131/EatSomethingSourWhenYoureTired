const express = require('express');
const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const { spendPoints } = require('../utils/pointsService');

const router = express.Router();

const VALID_SLOTS = ['nameColor', 'nameIcon', 'profileBorder', 'title'];

// GET /api/shop — list active items grouped by category
router.get('/', async (req, res) => {
  try {
    const items = await ShopItem.find({ isActive: true }).sort({ sortOrder: 1, cost: 1 });
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }
    res.json({ success: true, data: grouped });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/shop/inventory — current user's purchasedItems + equippedFlair
router.get('/inventory', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('purchasedItems.item')
      .select('purchasedItems equippedFlair pointsBalance');
    res.json({
      success: true,
      data: {
        purchasedItems: user.purchasedItems,
        equippedFlair: user.equippedFlair,
        pointsBalance: user.pointsBalance,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/shop/purchase — body: { itemId }
router.post('/purchase', async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ success: false, message: 'itemId is required' });
    }

    const item = await ShopItem.findById(itemId);
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const user = await User.findById(req.user._id);
    const alreadyOwns = user.purchasedItems.some(
      p => p.item.toString() === itemId
    );
    if (alreadyOwns) {
      return res.status(400).json({ success: false, message: 'You already own this item' });
    }

    if (user.pointsBalance < item.cost) {
      return res.status(400).json({ success: false, message: 'Insufficient points balance' });
    }

    await spendPoints(user._id, item.cost, { itemId: item._id });
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { item: item._id } },
    });

    res.json({ success: true, message: 'Purchase successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/shop/equip — body: { itemId, slot }
router.post('/equip', async (req, res) => {
  try {
    const { itemId, slot } = req.body;

    if (!VALID_SLOTS.includes(slot)) {
      return res.status(400).json({ success: false, message: 'Invalid slot' });
    }

    if (itemId === null || itemId === undefined || itemId === '') {
      await User.findByIdAndUpdate(req.user._id, {
        [`equippedFlair.${slot}`]: null,
      });
      return res.json({ success: true, message: 'Slot unequipped' });
    }

    const user = await User.findById(req.user._id);
    const owns = user.purchasedItems.some(p => p.item.toString() === itemId);
    if (!owns) {
      return res.status(403).json({ success: false, message: 'You do not own this item' });
    }

    const item = await ShopItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      [`equippedFlair.${slot}`]: item.value,
    });

    res.json({ success: true, message: 'Item equipped' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const SEED_ITEMS = [
  // nameColor — 8 items
  { name: 'Sakura Pink',    description: 'Delicate cherry blossom pink',            category: 'nameColor',     cost: 100, tier: 'entry',   value: 'text-pink-500',    sortOrder: 1 },
  { name: 'Sea Teal',       description: 'Inspired by the East China Sea',           category: 'nameColor',     cost: 100, tier: 'entry',   value: 'text-teal-600',    sortOrder: 2 },
  { name: 'Amber',          description: 'Warm amber glow',                          category: 'nameColor',     cost: 150, tier: 'entry',   value: 'text-amber-600',   sortOrder: 3 },
  { name: 'Jade Green',     description: 'Classic jade green',                       category: 'nameColor',     cost: 250, tier: 'mid',     value: 'text-emerald-600', sortOrder: 4 },
  { name: 'Ocean Blue',     description: 'A deep ocean blue',                        category: 'nameColor',     cost: 250, tier: 'mid',     value: 'text-blue-600',    sortOrder: 5 },
  { name: 'Royal Purple',   description: 'Regal and commanding',                     category: 'nameColor',     cost: 300, tier: 'mid',     value: 'text-purple-600',  sortOrder: 6 },
  { name: 'Crimson Dragon', description: 'The fierce red of a dragon',               category: 'nameColor',     cost: 600, tier: 'premium', value: 'text-red-600',     sortOrder: 7 },
  { name: 'Mahjong Gold',   description: 'The golden color of a winning hand',       category: 'nameColor',     cost: 700, tier: 'premium', value: 'text-yellow-600',  sortOrder: 8 },

  // nameIcon — 8 items
  { name: 'Cherry Blossom', description: 'A delicate sakura bloom',                  category: 'nameIcon',      cost: 100, tier: 'entry',   value: '🌸', sortOrder: 1 },
  { name: 'Bamboo',         description: 'A lucky bamboo stalk',                     category: 'nameIcon',      cost: 100, tier: 'entry',   value: '🎋', sortOrder: 2 },
  { name: 'Lucky Star',     description: 'For lucky players',                        category: 'nameIcon',      cost: 150, tier: 'entry',   value: '⭐', sortOrder: 3 },
  { name: 'Red Lantern',    description: 'A traditional festival lantern',           category: 'nameIcon',      cost: 200, tier: 'mid',     value: '🏮', sortOrder: 4 },
  { name: 'Mahjong Tile',   description: 'The iconic mahjong tile',                  category: 'nameIcon',      cost: 250, tier: 'mid',     value: '🀄', sortOrder: 5 },
  { name: 'Dragon',         description: 'A fearsome dragon',                        category: 'nameIcon',      cost: 300, tier: 'mid',     value: '🐉', sortOrder: 6 },
  { name: 'Flame',          description: 'You are on fire',                          category: 'nameIcon',      cost: 500, tier: 'premium', value: '🔥', sortOrder: 7 },
  { name: 'Crown',          description: 'Royalty at the table',                     category: 'nameIcon',      cost: 600, tier: 'premium', value: '👑', sortOrder: 8 },

  // profileBorder — 7 items
  { name: 'Blush',         description: 'A soft pink ring',                          category: 'profileBorder', cost: 100, tier: 'entry',   value: 'ring-2 ring-pink-300',    sortOrder: 1 },
  { name: 'Pebble',        description: 'A simple stone-grey ring',                  category: 'profileBorder', cost: 100, tier: 'entry',   value: 'ring-2 ring-gray-400',    sortOrder: 2 },
  { name: 'Jade Ring',     description: 'Rich jade border',                          category: 'profileBorder', cost: 250, tier: 'mid',     value: 'ring-2 ring-emerald-500', sortOrder: 3 },
  { name: 'Cobalt Ring',   description: 'Deep cobalt border',                        category: 'profileBorder', cost: 250, tier: 'mid',     value: 'ring-2 ring-blue-500',    sortOrder: 4 },
  { name: 'Sakura Ring',   description: 'Cherry blossom pink border',                category: 'profileBorder', cost: 300, tier: 'mid',     value: 'ring-2 ring-pink-400',    sortOrder: 5 },
  { name: 'Rainbow Halo',  description: 'Slowly spinning rainbow conic gradient',    category: 'profileBorder', cost: 600, tier: 'premium', value: 'flair-border-rainbow',    sortOrder: 6 },
  { name: 'Dragon Scale',  description: 'Spinning emerald gradient — shimmering scales', category: 'profileBorder', cost: 700, tier: 'premium', value: 'flair-border-dragon', sortOrder: 7 },

  // title — 7 items
  { name: 'Regular',       description: 'A familiar face at the table',              category: 'title',         cost: 100, tier: 'entry',   value: 'Regular',       sortOrder: 1 },
  { name: 'Tenpai',        description: 'Always one tile away from winning',         category: 'title',         cost: 150, tier: 'entry',   value: 'Tenpai',        sortOrder: 2 },
  { name: 'East Wind',     description: "The dealer's seat — a position of prestige", category: 'title',        cost: 250, tier: 'mid',     value: 'East Wind',     sortOrder: 3 },
  { name: 'Dragon Slayer', description: 'Defeated more than a few big hands',        category: 'title',         cost: 300, tier: 'mid',     value: 'Dragon Slayer', sortOrder: 4 },
  { name: 'Dora Hunter',   description: 'Always chasing bonus tiles',                category: 'title',         cost: 350, tier: 'mid',     value: 'Dora Hunter',   sortOrder: 5 },
  { name: 'Chicken Farmer', description: "Wins without a single yaku. Honkaku's nemesis.", category: 'title',  cost: 600, tier: 'premium', value: 'Chicken Farmer', sortOrder: 6 },
  { name: 'Chombo Chaser', description: 'A dedicated student of the penalty sheet.', category: 'title',         cost: 700, tier: 'premium', value: 'Chombo Chaser', sortOrder: 7 },
];

// POST /api/shop/seed — admin only, idempotent catalog seeding
router.post('/seed', async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const catalogNames = SEED_ITEMS.map(item => item.name);

    // Deactivate items no longer in the catalog
    await ShopItem.updateMany(
      { name: { $nin: catalogNames } },
      { $set: { isActive: false } }
    );

    const results = await Promise.all(
      SEED_ITEMS.map(({ name, category, cost, tier, description, value, sortOrder }) =>
        ShopItem.findOneAndUpdate(
          { name },
          {
            $set: { cost, tier, description, value, sortOrder },
            $setOnInsert: { name, category, isActive: true },
          },
          { upsert: true, new: true }
        )
      )
    );

    res.json({ success: true, message: `Seeded ${results.length} items`, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
