const express = require('express');
const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const { purchaseItem, PurchaseFailure } = require('../utils/shopService');
const { SHOP_CATALOG } = require('../data/shopCatalog');

const router = express.Router();

const VALID_SLOTS = ['nameColor', 'nameIcon', 'profileBorder', 'title'];

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const PURCHASE_FAILURE_RESPONSES = {
  [PurchaseFailure.UserNotFound]: { status: 404, message: 'User not found' },
  [PurchaseFailure.AlreadyOwned]: { status: 400, message: 'You already own this item' },
  [PurchaseFailure.InsufficientBalance]: { status: 400, message: 'Insufficient points balance' },
};

// typeof check also rejects object bodies like { itemId: { $ne: null } }, which would otherwise reach a query
function isObjectIdString(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

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
    if (!isObjectIdString(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid itemId' });
    }

    const item = await ShopItem.findById(itemId);
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const result = await purchaseItem(req.user._id, item);
    if (!result.purchased) {
      const failure = PURCHASE_FAILURE_RESPONSES[result.reason];
      return res.status(failure.status).json({ success: false, message: failure.message });
    }

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

// POST /api/shop/seed — admin only, idempotent catalog seeding
router.post('/seed', async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const catalogNames = SHOP_CATALOG.map(item => item.name);

    // Deactivate items no longer in the catalog
    await ShopItem.updateMany(
      { name: { $nin: catalogNames } },
      { $set: { isActive: false } }
    );

    const results = await Promise.all(
      SHOP_CATALOG.map(({ name, category, cost, tier, description, value, sortOrder }) =>
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
