// Single source of truth for the flair slot names. ShopItem.category, User.equippedFlair and the
// shop route's equip slots are all built from this list, so adding a category here adds it everywhere.
// The client mirrors it in `FlairCategory` (client/src/services/api.ts); flairCatalog.test.ts guards that.

const FLAIR_CATEGORIES = Object.freeze([
  'nameColor',
  'nameIcon',
  'profileBorder',
  'profileBackdrop',
  'title',
]);

// Slots drawn beside a player's name in game rows and member lists. Every other slot is
// profile-only and must stay out of player payloads (see PLAYER_POPULATE_FIELDS).
const INLINE_FLAIR_CATEGORIES = Object.freeze(
  FLAIR_CATEGORIES.filter(category => category !== 'profileBackdrop')
);

module.exports = { FLAIR_CATEGORIES, INLINE_FLAIR_CATEGORIES };
