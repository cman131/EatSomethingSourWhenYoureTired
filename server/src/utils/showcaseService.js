// Validation for the profile showcase: up to SHOWCASE_MAX_ENTRIES things a player pins to their
// profile. Entries reference things that already exist (owned flair, the player's favorite yaku
// or tile, and stats computed by GET /api/users/:id/stats) rather than introducing new badges.
// Pure functions only, so the User model can import the constants without a circular dependency.

const { FLAIR_CATEGORIES } = require('../data/flairCategories');

const SHOWCASE_MAX_ENTRIES = 3;

const ShowcaseEntryType = Object.freeze({
  Flair: 'flair',
  FavoriteYaku: 'favoriteYaku',
  FavoriteTile: 'favoriteTile',
  Stat: 'stat',
});

const SHOWCASE_ENTRY_TYPES = Object.freeze(Object.values(ShowcaseEntryType));

// Keys of the stats object returned by GET /api/users/:id/stats.
const SHOWCASE_STAT_KEYS = Object.freeze(['gamesWon', 'gamesPlayed', 'highestScore', 'averageScore']);

const invalid = message => ({ valid: false, message });

function normalizeFlairEntry(entry, ownedFlair) {
  const { category, value } = entry;
  if (!FLAIR_CATEGORIES.includes(category) || typeof value !== 'string') {
    return invalid('Pinned flair must have a valid category and value');
  }
  const owned = ownedFlair.some(item => item.category === category && item.value === value);
  if (!owned) {
    return invalid('You do not own a flair item you tried to pin');
  }
  return { valid: true, entry: { type: ShowcaseEntryType.Flair, category, value } };
}

function normalizeFavoriteEntry(type, isSet, label) {
  return isSet
    ? { valid: true, entry: { type } }
    : invalid(`Set a ${label} before pinning it`);
}

function normalizeStatEntry(entry) {
  return SHOWCASE_STAT_KEYS.includes(entry.key)
    ? { valid: true, entry: { type: ShowcaseEntryType.Stat, key: entry.key } }
    : invalid('Unknown stat');
}

function normalizeEntry(entry, profile) {
  if (entry === null || typeof entry !== 'object') {
    return invalid('Showcase entries must be objects');
  }
  switch (entry.type) {
    case ShowcaseEntryType.Flair:
      return normalizeFlairEntry(entry, profile.ownedFlair);
    case ShowcaseEntryType.FavoriteYaku:
      return normalizeFavoriteEntry(entry.type, Boolean(profile.favoriteYaku), 'favorite yaku');
    case ShowcaseEntryType.FavoriteTile:
      return normalizeFavoriteEntry(entry.type, Boolean(profile.favoriteTile), 'favorite tile');
    case ShowcaseEntryType.Stat:
      return normalizeStatEntry(entry);
    default:
      return invalid('Unknown showcase entry type');
  }
}

const entryKey = entry => JSON.stringify([entry.type, entry.category, entry.value, entry.key]);

// profile: { ownedFlair: [{ category, value }], favoriteYaku, favoriteTile }
// Returns { valid: true, entries } with each entry reduced to the fields its type uses, or
// { valid: false, message }.
function validateShowcase(entries, profile) {
  if (!Array.isArray(entries)) {
    return invalid('Showcase must be a list');
  }
  if (entries.length > SHOWCASE_MAX_ENTRIES) {
    return invalid(`Showcase can hold at most ${SHOWCASE_MAX_ENTRIES} entries`);
  }

  const normalized = [];
  for (const entry of entries) {
    const result = normalizeEntry(entry, profile);
    if (!result.valid) {
      return result;
    }
    normalized.push(result.entry);
  }

  if (new Set(normalized.map(entryKey)).size !== normalized.length) {
    return invalid('Showcase cannot contain duplicate entries');
  }
  return { valid: true, entries: normalized };
}

module.exports = {
  SHOWCASE_MAX_ENTRIES,
  SHOWCASE_ENTRY_TYPES,
  SHOWCASE_STAT_KEYS,
  ShowcaseEntryType,
  validateShowcase,
};
