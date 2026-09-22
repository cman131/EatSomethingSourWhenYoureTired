// Validation and application logic for User.flairLoadouts (saved, named combinations of the
// flair slots a player can one-click apply). Reuses the same slot/category/value matching
// as equippedFlairAudit.js, but built from a user's *owned* items rather than the full catalog —
// so an item is valid in a loadout exactly when it would be valid to /equip directly, including
// retired (no-longer-sold) items the user already owns.
const { buildValidValueLookup, findInvalidSlots } = require('./equippedFlairAudit');
const { FLAIR_CATEGORIES } = require('../data/flairCategories');
const User = require('../models/User');

// A later tech-debt item (flair/shop-points-sink-and-sellback.md) may let players purchase
// additional loadout slots; when it lands, raise this one constant.
const MAX_FLAIR_LOADOUTS = 2;

const LOADOUT_SLOT_KEYS = FLAIR_CATEGORIES;

// Pulls just the flair slots off a loadout-like object (a Mongoose subdocument or a plain
// request body), defaulting any missing/undefined slot to null so it's treated as empty.
function extractSlots(loadout) {
  const slots = {};
  for (const key of LOADOUT_SLOT_KEYS) {
    slots[key] = loadout[key] ?? null;
  }
  return slots;
}

// ownedItems: plain objects (or populated ShopItem docs) with `category` and `value` — the
// user's purchasedItems' items, isActive or not.
function validateLoadoutSlots(ownedItems, loadout) {
  const lookup = buildValidValueLookup(ownedItems);
  const invalidSlots = findInvalidSlots(extractSlots(loadout), lookup);

  if (invalidSlots.length > 0) {
    return { valid: false, invalidSlots };
  }
  return { valid: true };
}

// Atomically writes every equippedFlair.* field from a loadout's slots in one update, so a
// loadout apply can never leave equippedFlair in a partially-applied state.
async function applyLoadout(userId, loadout) {
  const slots = extractSlots(loadout);
  const update = {};
  for (const key of LOADOUT_SLOT_KEYS) {
    update[`equippedFlair.${key}`] = slots[key];
  }
  return User.findByIdAndUpdate(userId, update, { new: true });
}

module.exports = {
  MAX_FLAIR_LOADOUTS,
  LOADOUT_SLOT_KEYS,
  validateLoadoutSlots,
  applyLoadout,
};
