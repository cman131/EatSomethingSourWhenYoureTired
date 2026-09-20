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

    await User.findByIdAndUpdate(req.user._id, {
      [`equippedFlair.${slot}`]: itemId,
    });

    res.json({ success: true, message: 'Item equipped' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const SEED_ITEMS = [
  { name: 'Jade Green', description: 'A calming jade green name color', category: 'nameColor', cost: 200, value: 'text-emerald-600', sortOrder: 1 },
  { name: 'Crimson', description: 'A bold crimson name color', category: 'nameColor', cost: 200, value: 'text-red-600', sortOrder: 2 },
  { name: 'Royal Purple', description: 'A regal purple name color', category: 'nameColor', cost: 200, value: 'text-purple-600', sortOrder: 3 },
  { name: 'Ocean Blue', description: 'A deep ocean blue name color', category: 'nameColor', cost: 200, value: 'text-blue-600', sortOrder: 4 },
  { name: 'Mahjong Gold', description: 'The golden color of a winning hand', category: 'nameColor', cost: 350, value: 'text-yellow-500', sortOrder: 5 },
  { name: 'Dragon', description: 'A fearsome dragon icon', category: 'nameIcon', cost: 150, value: '🐉', sortOrder: 1 },
  { name: 'Cherry Blossom', description: 'A delicate cherry blossom', category: 'nameIcon', cost: 150, value: '🌸', sortOrder: 2 },
  { name: 'Mahjong Tile', description: 'The iconic mahjong tile', category: 'nameIcon', cost: 150, value: '🀄', sortOrder: 3 },
  { name: 'Lucky Star', description: 'A lucky star for lucky players', category: 'nameIcon', cost: 150, value: '⭐', sortOrder: 4 },
  { name: 'Bamboo', description: 'A bamboo stalk', category: 'nameIcon', cost: 150, value: '🎋', sortOrder: 5 },
  { name: 'Flame', description: 'You are on fire', category: 'nameIcon', cost: 250, value: '🔥', sortOrder: 6 },
  { name: 'Gold Ring', description: 'A gleaming gold ring border', category: 'profileBorder', cost: 300, value: 'ring-2 ring-yellow-400', sortOrder: 1 },
  { name: 'Dragon Scale', description: 'Shimmering dragon scale border', category: 'profileBorder', cost: 400, value: 'ring-2 ring-emerald-500 ring-offset-1', sortOrder: 2 },
  { name: 'Sakura', description: 'A delicate pink sakura border', category: 'profileBorder', cost: 300, value: 'ring-2 ring-pink-400', sortOrder: 3 },
  { name: 'Newcomer', description: 'For those just starting out', category: 'title', cost: 50, value: 'Newcomer', sortOrder: 1 },
  { name: 'Dragon (Title)', description: 'A title for those who dominate', category: 'title', cost: 300, value: 'Dragon', sortOrder: 2 },
  { name: 'Champion', description: 'A title for tournament champions', category: 'title', cost: 400, value: 'Champion', sortOrder: 3 },
  { name: 'Riichi Master', description: 'A title for seasoned riichi players', category: 'title', cost: 500, value: 'Riichi Master', sortOrder: 4 },
];

// POST /api/shop/seed — admin only, idempotent catalog seeding
router.post('/seed', async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const results = await Promise.all(
      SEED_ITEMS.map(item =>
        ShopItem.findOneAndUpdate(
          { name: item.name },
          { $setOnInsert: item },
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
