const { SHOP_CATALOG } = require('./shopCatalog');
const { FLAIR_CATEGORIES } = require('./flairCategories');
const { PRESTIGE_TITLE_MARKER } = require('../utils/prestigeTitle');

// The pre-expansion catalog (30 items) with the original prices. An existing item's `value`
// is stored verbatim in User.equippedFlair, so these values must never change.
const LEGACY_ITEMS = Object.freeze([
  { name: 'Sakura Pink', category: 'nameColor', tier: 'entry', value: 'flair-color-pink', oldCost: 100 },
  { name: 'Sea Teal', category: 'nameColor', tier: 'entry', value: 'flair-color-teal', oldCost: 100 },
  { name: 'Amber', category: 'nameColor', tier: 'entry', value: 'flair-color-amber', oldCost: 150 },
  { name: 'Jade Green', category: 'nameColor', tier: 'mid', value: 'flair-color-emerald', oldCost: 250 },
  { name: 'Ocean Blue', category: 'nameColor', tier: 'mid', value: 'flair-color-blue', oldCost: 250 },
  { name: 'Royal Purple', category: 'nameColor', tier: 'mid', value: 'flair-color-purple', oldCost: 300 },
  { name: 'Crimson Dragon', category: 'nameColor', tier: 'premium', value: 'flair-color-red', oldCost: 600 },
  { name: 'Mahjong Gold', category: 'nameColor', tier: 'premium', value: 'flair-color-gold', oldCost: 600 },
  { name: 'Red Lantern', category: 'nameIcon', tier: 'entry', value: '🏮', oldCost: 100 },
  { name: 'Mahjong Tile', category: 'nameIcon', tier: 'entry', value: '🀄', oldCost: 100 },
  { name: 'Lucky Star', category: 'nameIcon', tier: 'entry', value: '⭐', oldCost: 150 },
  { name: 'Bamboo', category: 'nameIcon', tier: 'mid', value: '🎋', oldCost: 200 },
  { name: 'Crown', category: 'nameIcon', tier: 'mid', value: '👑', oldCost: 250 },
  { name: 'Dragon', category: 'nameIcon', tier: 'mid', value: '🐉', oldCost: 300 },
  { name: 'Flame', category: 'nameIcon', tier: 'premium', value: '🔥', oldCost: 500 },
  { name: 'Cherry Blossom', category: 'nameIcon', tier: 'premium', value: '🌸', oldCost: 600 },
  { name: 'Blush', category: 'profileBorder', tier: 'entry', value: 'flair-ring-blush', oldCost: 100 },
  { name: 'Pebble', category: 'profileBorder', tier: 'entry', value: 'flair-ring-pebble', oldCost: 100 },
  { name: 'Jade Ring', category: 'profileBorder', tier: 'mid', value: 'flair-mid-jade', oldCost: 250 },
  { name: 'Cobalt Ring', category: 'profileBorder', tier: 'mid', value: 'flair-mid-cobalt', oldCost: 250 },
  { name: 'Sakura Ring', category: 'profileBorder', tier: 'mid', value: 'flair-mid-sakura', oldCost: 300 },
  { name: 'Rainbow Halo', category: 'profileBorder', tier: 'premium', value: 'flair-border-rainbow', oldCost: 600 },
  { name: 'Dragon Scale', category: 'profileBorder', tier: 'premium', value: 'flair-border-dragon', oldCost: 600 },
  { name: 'Regular', category: 'title', tier: 'entry', value: 'Regular', oldCost: 100 },
  { name: 'Tenpai', category: 'title', tier: 'entry', value: 'Tenpai', oldCost: 150 },
  { name: 'East Wind', category: 'title', tier: 'mid', value: 'East Wind', oldCost: 250 },
  { name: 'Dragon Slayer', category: 'title', tier: 'mid', value: 'Dragon Slayer', oldCost: 300 },
  { name: 'Dora Hunter', category: 'title', tier: 'mid', value: 'Dora Hunter', oldCost: 350 },
  { name: 'Chicken Farmer', category: 'title', tier: 'premium', value: 'Chicken Farmer', oldCost: 600 },
  { name: 'Chombo Chaser', category: 'title', tier: 'premium', value: 'Chombo Chaser', oldCost: 600 },
]);

const CATEGORIES = ['nameColor', 'nameIcon', 'profileBorder', 'profileBackdrop', 'title'];
// The four categories that shipped before the backdrop; each got the full 6/5/3 expansion.
const EXPANDED_CATEGORIES = ['nameColor', 'nameIcon', 'profileBorder', 'title'];
const TIER_ORDER = { entry: 0, mid: 1, premium: 2 };
const PRICE_BANDS = { entry: [50, 75], mid: [100, 175], premium: [250, 300] };
const BORDER_PREFIX_BY_TIER = {
  entry: 'flair-ring-',
  mid: 'flair-mid-',
  premium: 'flair-border-',
};

describe('SHOP_CATALOG', () => {
  test('every item has the required fields with valid category and tier', () => {
    for (const item of SHOP_CATALOG) {
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.name).toBe(item.name.trim());
      expect(typeof item.description).toBe('string');
      expect(item.description.length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(item.category);
      expect(Object.keys(TIER_ORDER)).toContain(item.tier);
      expect(Number.isInteger(item.cost)).toBe(true);
      expect(typeof item.value).toBe('string');
      expect(item.value.length).toBeGreaterThan(0);
      expect(item.value).toBe(item.value.trim());
      expect(Number.isInteger(item.sortOrder)).toBe(true);
    }
  });

  test('names are unique across the whole catalog (the seed matches on name)', () => {
    const names = SHOP_CATALOG.map(item => item.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('values are unique within each category', () => {
    for (const category of CATEGORIES) {
      const values = SHOP_CATALOG.filter(i => i.category === category).map(i => i.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  test('costs sit inside each tier price band', () => {
    for (const item of SHOP_CATALOG) {
      const [min, max] = PRICE_BANDS[item.tier];
      expect(item.cost).toBeGreaterThanOrEqual(min);
      expect(item.cost).toBeLessThanOrEqual(max);
    }
  });

  test('sortOrder is unique per category and lists entry, then mid, then premium', () => {
    for (const category of CATEGORIES) {
      const items = SHOP_CATALOG.filter(i => i.category === category).sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
      const orders = items.map(i => i.sortOrder);
      expect(new Set(orders).size).toBe(orders.length);
      const tiers = items.map(i => TIER_ORDER[i.tier]);
      expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    }
  });

  test('border values use the class prefix that matches their tier', () => {
    for (const item of SHOP_CATALOG.filter(i => i.category === 'profileBorder')) {
      expect(item.value.startsWith(BORDER_PREFIX_BY_TIER[item.tier])).toBe(true);
    }
  });

  test('the shared category list matches the categories the catalog is checked against', () => {
    expect([...FLAIR_CATEGORIES].sort()).toEqual([...CATEGORIES].sort());
  });

  test('every expanded category keeps its post-expansion tier coverage', () => {
    for (const category of EXPANDED_CATEGORIES) {
      const tiers = SHOP_CATALOG.filter(i => i.category === category).map(i => i.tier);
      expect(tiers.filter(t => t === 'entry').length).toBeGreaterThanOrEqual(6);
      expect(tiers.filter(t => t === 'mid').length).toBeGreaterThanOrEqual(5);
      expect(tiers.filter(t => t === 'premium').length).toBeGreaterThanOrEqual(3);
    }
  });

  test('the backdrop category offers at least three entry, two mid and two premium items', () => {
    const tiers = SHOP_CATALOG.filter(i => i.category === 'profileBackdrop').map(i => i.tier);
    expect(tiers.filter(t => t === 'entry').length).toBeGreaterThanOrEqual(3);
    expect(tiers.filter(t => t === 'mid').length).toBeGreaterThanOrEqual(2);
    expect(tiers.filter(t => t === 'premium').length).toBeGreaterThanOrEqual(2);
  });

  test('backdrop values use the flair-backdrop- class prefix', () => {
    for (const item of SHOP_CATALOG.filter(i => i.category === 'profileBackdrop')) {
      expect(item.value.startsWith('flair-backdrop-')).toBe(true);
    }
  });

  test('the legacy fixture lists all 30 pre-expansion items', () => {
    expect(LEGACY_ITEMS).toHaveLength(30);
  });

  test.each(LEGACY_ITEMS)(
    'legacy item $name keeps its category, tier and value and is repriced to half',
    legacy => {
      const item = SHOP_CATALOG.find(i => i.name === legacy.name);
      if (!item) {
        throw new Error(`Legacy item "${legacy.name}" is missing from SHOP_CATALOG`);
      }
      expect(item.category).toBe(legacy.category);
      expect(item.tier).toBe(legacy.tier);
      expect(item.value).toBe(legacy.value);
      expect(item.cost).toBe(legacy.oldCost / 2);
    }
  );

  test('the torii gate icon keeps its emoji variation selector', () => {
    const torii = SHOP_CATALOG.find(i => i.name === 'Torii Gate');
    expect(torii.value).toBe('\u26E9\uFE0F');
  });

  test('no catalog name or value can be mistaken for an earned prestige title', () => {
    for (const item of SHOP_CATALOG) {
      expect(item.name.startsWith(PRESTIGE_TITLE_MARKER)).toBe(false);
      expect(item.value.startsWith(PRESTIGE_TITLE_MARKER)).toBe(false);
    }
  });

  test('the catalog contains only purchasable shop items', () => {
    for (const item of SHOP_CATALOG) {
      expect(item.tier).not.toBe('prestige');
      expect(item.acquisition === undefined || item.acquisition === 'shop').toBe(true);
    }
  });

  test('an availability window opens before it closes', () => {
    for (const item of SHOP_CATALOG) {
      if (item.availableFrom && item.availableUntil) {
        const fromMs = new Date(item.availableFrom).getTime();
        const untilMs = new Date(item.availableUntil).getTime();
        // NaN < NaN (and NaN < number) is false, so a malformed date would silently pass below.
        expect(Number.isNaN(fromMs) || Number.isNaN(untilMs)).toBe(false);
        expect(fromMs).toBeLessThan(untilMs);
      }
    }
  });
});
