const { SHOP_CATALOG } = require('./shopCatalog');

const CATEGORIES = ['nameColor', 'nameIcon', 'profileBorder', 'title'];
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
      expect(typeof item.description).toBe('string');
      expect(item.description.length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(item.category);
      expect(Object.keys(TIER_ORDER)).toContain(item.tier);
      expect(Number.isInteger(item.cost)).toBe(true);
      expect(typeof item.value).toBe('string');
      expect(item.value.length).toBeGreaterThan(0);
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

  test('every category keeps its post-expansion tier coverage', () => {
    for (const category of CATEGORIES) {
      const tiers = SHOP_CATALOG.filter(i => i.category === category).map(i => i.tier);
      expect(tiers.filter(t => t === 'entry').length).toBeGreaterThanOrEqual(6);
      expect(tiers.filter(t => t === 'mid').length).toBeGreaterThanOrEqual(5);
      expect(tiers.filter(t => t === 'premium').length).toBeGreaterThanOrEqual(3);
    }
  });

  test('halved prices: existing items were repriced in place', () => {
    const cost = name => SHOP_CATALOG.find(i => i.name === name).cost;
    expect(cost('Regular')).toBe(50);
    expect(cost('Tenpai')).toBe(75);
    expect(cost('Bamboo')).toBe(100);
    expect(cost('Jade Green')).toBe(125);
    expect(cost('Royal Purple')).toBe(150);
    expect(cost('Dora Hunter')).toBe(175);
    expect(cost('Flame')).toBe(250);
    expect(cost('Mahjong Gold')).toBe(300);
  });

  test('existing item values are unchanged', () => {
    const value = name => SHOP_CATALOG.find(i => i.name === name).value;
    expect(value('Jade Green')).toBe('flair-color-emerald');
    expect(value('Crimson Dragon')).toBe('flair-color-red');
    expect(value('Jade Ring')).toBe('flair-mid-jade');
    expect(value('Rainbow Halo')).toBe('flair-border-rainbow');
    expect(value('Flame')).toBe('🔥');
  });

  test('the torii gate icon keeps its emoji variation selector', () => {
    const torii = SHOP_CATALOG.find(i => i.name === 'Torii Gate');
    expect(torii.value).toBe('\u26E9\uFE0F');
  });
});
