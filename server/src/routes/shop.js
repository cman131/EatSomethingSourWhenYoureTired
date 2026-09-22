const express = require('express');
const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const { purchaseItem, PurchaseFailure } = require('../utils/shopService');
const {
  MAX_FLAIR_LOADOUTS,
  validateLoadoutSlots,
  applyLoadout,
} = require('../utils/flairLoadoutService');
const { SHOP_CATALOG } = require('../data/shopCatalog');
const {
  validateMongoIdBody,
  validateOptionalMongoIdBody,
  validateMongoId,
  validateLoadoutName,
} = require('../middleware/validation');

const router = express.Router();

const VALID_SLOTS = ['nameColor', 'nameIcon', 'profileBorder', 'title'];

function loadoutFromBody(reqBody) {
  const slots = { name: typeof reqBody.name === 'string' ? reqBody.name.trim() : reqBody.name };
  for (const slot of VALID_SLOTS) {
    slots[slot] = reqBody[slot] ?? null;
  }
  return slots;
}

const PURCHASE_FAILURE_RESPONSES = {
  [PurchaseFailure.UserNotFound]: { status: 404, message: 'User not found' },
  [PurchaseFailure.AlreadyOwned]: { status: 400, message: 'You already own this item' },
  [PurchaseFailure.InsufficientBalance]: { status: 400, message: 'Insufficient points balance' },
};

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

// GET /api/shop/inventory — current user's purchasedItems + equippedFlair.
// Owned items are returned even when retired (isActive: false) so owners can still equip or
// unequip them; purchases whose ShopItem no longer exists are skipped.
router.get('/inventory', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('purchasedItems.item')
      .select('purchasedItems equippedFlair pointsBalance');
    res.json({
      success: true,
      data: {
        purchasedItems: user.purchasedItems.filter(p => p.item),
        equippedFlair: user.equippedFlair,
        pointsBalance: user.pointsBalance,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/shop/purchase — body: { itemId }
router.post('/purchase', validateMongoIdBody('itemId'), async (req, res) => {
  try {
    const { itemId } = req.body;

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
router.post('/equip', validateOptionalMongoIdBody('itemId'), async (req, res) => {
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

    if (item.category !== slot) {
      return res.status(400).json({ success: false, message: 'Item does not belong in this slot' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      [`equippedFlair.${slot}`]: item.value,
    });

    res.json({ success: true, message: 'Item equipped' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/shop/loadouts — body: { name, nameColor, nameIcon, profileBorder, title }
router.post('/loadouts', validateLoadoutName, async (req, res) => {
  try {
    const loadout = loadoutFromBody(req.body);

    const user = await User.findById(req.user._id).populate('purchasedItems.item');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.flairLoadouts.length >= MAX_FLAIR_LOADOUTS) {
      return res.status(400).json({
        success: false,
        message: `You can only save up to ${MAX_FLAIR_LOADOUTS} loadouts`,
      });
    }

    const ownedItems = user.purchasedItems.filter(p => p.item).map(p => p.item);
    const validation = validateLoadoutSlots(ownedItems, loadout);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Loadout includes an item you do not own' });
    }

    user.flairLoadouts.push(loadout);
    await user.save();

    res.json({ success: true, message: 'Loadout saved', data: user.flairLoadouts[user.flairLoadouts.length - 1] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/shop/loadouts/:loadoutId — body: any subset of { name, nameColor, nameIcon, profileBorder, title }
router.put('/loadouts/:loadoutId', validateMongoId('loadoutId'), async (req, res) => {
  try {
    const { loadoutId } = req.params;

    if (req.body.name !== undefined && typeof req.body.name !== 'string') {
      return res.status(400).json({ success: false, message: 'Loadout name must be a string' });
    }

    const user = await User.findById(req.user._id).populate('purchasedItems.item');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const loadout = user.flairLoadouts.id(loadoutId);
    if (!loadout) {
      return res.status(404).json({ success: false, message: 'Loadout not found' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : loadout.name;
    if (!name || name.length > 30) {
      return res.status(400).json({ success: false, message: 'Loadout name must be between 1 and 30 characters' });
    }

    const updatedSlots = { name };
    for (const slot of VALID_SLOTS) {
      updatedSlots[slot] = req.body[slot] !== undefined ? req.body[slot] : loadout[slot];
    }

    const ownedItems = user.purchasedItems.filter(p => p.item).map(p => p.item);
    const validation = validateLoadoutSlots(ownedItems, updatedSlots);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Loadout includes an item you do not own' });
    }

    loadout.name = updatedSlots.name;
    for (const slot of VALID_SLOTS) {
      loadout[slot] = updatedSlots[slot];
    }
    await user.save();

    res.json({ success: true, message: 'Loadout updated', data: loadout });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/shop/loadouts/:loadoutId
router.delete('/loadouts/:loadoutId', validateMongoId('loadoutId'), async (req, res) => {
  try {
    const { loadoutId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const loadout = user.flairLoadouts.id(loadoutId);
    if (!loadout) {
      return res.status(404).json({ success: false, message: 'Loadout not found' });
    }

    user.flairLoadouts.pull(loadoutId);
    await user.save();

    res.json({ success: true, message: 'Loadout deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/shop/loadouts/:loadoutId/apply — atomically sets all four equippedFlair slots
router.post('/loadouts/:loadoutId/apply', validateMongoId('loadoutId'), async (req, res) => {
  try {
    const { loadoutId } = req.params;

    const user = await User.findById(req.user._id).populate('purchasedItems.item');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const loadout = user.flairLoadouts.id(loadoutId);
    if (!loadout) {
      return res.status(404).json({ success: false, message: 'Loadout not found' });
    }

    const ownedItems = user.purchasedItems.filter(p => p.item).map(p => p.item);
    const validation = validateLoadoutSlots(ownedItems, loadout);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Loadout includes an item you do not own' });
    }

    await applyLoadout(user._id, loadout);

    res.json({ success: true, message: 'Loadout applied' });
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
            $set: { cost, tier, description, value, sortOrder, isActive: true },
            $setOnInsert: { name, category },
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
