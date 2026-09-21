# Flair Catalog Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 33 new flair items (30 → 63) with clearly tiered styling for name colors and name icons, halved prices, a single shared catalog module, ring-only premium border spin, and the shop's equipped-state fix.

**Architecture:** A data-driven style registry in `client/src/utils/flairUtils.ts` maps the stored `value` strings to tier/class info. Two small components (`FlairName`, `FlairIcon`) and one shared `TitleBadge` render flair everywhere (`UserDisplay`, profile header, Shop). All look-and-feel lives in `client/src/styles/flair.css`. The server catalog moves to `server/src/data/shopCatalog.js`, shared by the seed script and the seed route.

**Tech Stack:** React 18 + TypeScript (CRA, Jest, React Testing Library), Tailwind, plain CSS; Node/Express, Mongoose, Jest + supertest.

**Spec:** `docs/superpowers/specs/2026-09-21-flair-catalog-expansion-design.md` (read it first; this plan implements it).

---

## Ground rules for every task

- Work on branch `feat/flair-catalog-expansion` from the repo root `C:\Users\conor\workbench\mahjong-site`.
- **Client tests:** `cd client && npm test -- --watchAll=false --testPathPattern="<pattern>"`. The `--watchAll=false` flag is mandatory; without it the process hangs forever.
- **Server tests:** `cd server && npx jest <path>`. Files named `shop.test.js` and `User.shopFlair.test.js` need a MongoDB at `mongodb://localhost:27017` (or `MONGO_URI`). `shopCatalog.test.js` is pure and needs no database. If no MongoDB is available, run only the pure test and say so in your report; do not skip silently.
- **Style:** 2-space indent, single quotes, semicolons, braces on every `if`, final newline, LF. Prettier is not installed and there is no config in the repo, so `prettier --check` cannot be run; match the surrounding code by hand.
- **Commits:** frequent, one per task. End every commit message with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` as a second `-m` argument (examples below).
- **Never rename an existing item's `value`.** Users' `equippedFlair` stores those strings verbatim.

### Deviations from the spec (decided while planning)

1. The profile header (`client/src/components/profile/UserInfoSection.tsx`) also renders name color and icon inside one element, so it has the same gradient-clipping problem as `UserDisplay`. The spec did not list it; Task 9 covers it.
2. The spec listed an `isPremiumNameColor` helper. Nothing needs it (`FlairName` reads `sparkleClass` from the registry), so it is not built.
3. Reduced-motion: premium icons keep a static colored glow instead of losing it entirely (Task 4).

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `client/src/utils/flairUtils.ts` | Rewrite | Style registry (titles, icons, name colors), border prefix helpers, `isFlairEquipped` |
| `client/src/utils/__tests__/flairUtils.test.ts` | Extend | Registry and helper tests |
| `client/src/utils/__tests__/flairCatalog.test.ts` | Create | Cross-check: server catalog ↔ client registry ↔ `flair.css` |
| `client/src/styles/flair.css` | Rewrite | All flair styling, animations, reduced-motion rules |
| `client/src/components/user/FlairName.tsx` | Create | Name text with color class and premium sparkles |
| `client/src/components/user/FlairIcon.tsx` | Create | Emoji wrapper with tier class |
| `client/src/components/user/TitleBadge.tsx` | Rewrite | Shared title badge driven by registry |
| `client/src/components/user/UserDisplay.tsx` | Modify | Use `FlairName` / `FlairIcon` |
| `client/src/components/profile/UserInfoSection.tsx` | Modify | Use `FlairName` / `FlairIcon` |
| `client/src/pages/Shop.tsx` | Modify | Shared components, delete private `TitleBadge`, equip fix |
| `server/src/data/shopCatalog.js` | Create | The 63-item catalog (single source of truth) |
| `server/src/data/shopCatalog.test.js` | Create | Catalog integrity tests |
| `server/scripts/seedShop.js` | Rewrite | Import the shared catalog |
| `server/src/routes/shop.js` | Modify | Delete stale `SEED_ITEMS`, import shared catalog |
| `docs/flair-style-guide.md` | Rewrite | Updated tier rules |

---

### Task 1: Style registry in `flairUtils.ts`

**Files:**
- Modify: `client/src/utils/flairUtils.ts`
- Test: `client/src/utils/__tests__/flairUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace line 1 of `client/src/utils/__tests__/flairUtils.test.ts` (`import { isMidTierBorder, getMidTierTitleClass } from '../flairUtils';`) with:

```ts
import {
  isPremiumBorder,
  isMidTierBorder,
  getPremiumTitleClass,
  getPremiumTitleEmoji,
  getMidTierTitleClass,
  getTitleStyle,
  getIconStyle,
  getIconClass,
  getNameColorStyle,
  isFlairEquipped,
} from '../flairUtils';
```

Keep the two existing `describe` blocks. Then append this to the end of the file:

```ts
describe('isPremiumBorder', () => {
  test('returns true for flair-border- prefix only', () => {
    expect(isPremiumBorder('flair-border-hanabi')).toBe(true);
    expect(isPremiumBorder('flair-mid-torii')).toBe(false);
    expect(isPremiumBorder('flair-ring-manzu')).toBe(false);
  });
});

describe('getTitleStyle', () => {
  test.each([
    ['Regular', 'entry'],
    ['Tenpai', 'entry'],
    ['Nakama', 'entry'],
    ['Chi Chi', 'entry'],
    ['PonPonPon', 'entry'],
    ['Kan I Help You?', 'entry'],
    ['East Wind', 'mid'],
    ['Dragon Slayer', 'mid'],
    ['Dora Hunter', 'mid'],
    ['Power of Friendship', 'mid'],
    ['Over 9000 Han', 'mid'],
    ['Chicken Farmer', 'premium'],
    ['Chombo Chaser', 'premium'],
    ['Tsumo-nami', 'premium'],
  ])('%s is %s tier', (title, tier) => {
    expect(getTitleStyle(title)?.tier).toBe(tier);
  });

  test('returns null for unknown titles, including inherited object keys', () => {
    expect(getTitleStyle('Dragon')).toBeNull();
    expect(getTitleStyle('')).toBeNull();
    expect(getTitleStyle('constructor')).toBeNull();
    expect(getTitleStyle('__proto__')).toBeNull();
  });
});

describe('title class helpers', () => {
  test('Tsumo-nami is premium with its own class and wave emoji', () => {
    expect(getPremiumTitleClass('Tsumo-nami')).toBe('flair-title-tsumonami');
    expect(getPremiumTitleEmoji('Tsumo-nami')).toBe('🌊');
  });

  test('existing premium titles keep their class and emoji', () => {
    expect(getPremiumTitleClass('Chicken Farmer')).toBe('flair-title-chicken');
    expect(getPremiumTitleEmoji('Chicken Farmer')).toBe('🐔');
    expect(getPremiumTitleClass('Chombo Chaser')).toBe('flair-title-chombo');
    expect(getPremiumTitleEmoji('Chombo Chaser')).toBe('⚡');
  });

  test('new mid titles share flair-title-mid; entry titles get no class', () => {
    expect(getMidTierTitleClass('Power of Friendship')).toBe('flair-title-mid');
    expect(getMidTierTitleClass('Over 9000 Han')).toBe('flair-title-mid');
    expect(getMidTierTitleClass('Nakama')).toBe('');
    expect(getPremiumTitleClass('Nakama')).toBe('');
    expect(getPremiumTitleEmoji('East Wind')).toBe('');
  });
});

describe('getIconStyle / getIconClass', () => {
  test.each([
    ['🏮', 'entry'],
    ['🀄', 'entry'],
    ['⭐', 'entry'],
    ['🍙', 'entry'],
    ['🍡', 'entry'],
    ['🎴', 'entry'],
    ['🎐', 'entry'],
    ['🎋', 'mid'],
    ['👑', 'mid'],
    ['🐉', 'mid'],
    ['\u26E9\uFE0F', 'mid'],
    ['🦊', 'mid'],
    ['🔥', 'premium'],
    ['🌸', 'premium'],
    ['🎆', 'premium'],
    ['🌊', 'premium'],
    ['🥷', 'premium'],
  ])('%s is %s tier', (emoji, tier) => {
    expect(getIconStyle(emoji)?.tier).toBe(tier);
  });

  test('mid icons share the glow class', () => {
    expect(getIconClass('👑')).toBe('flair-icon-glow');
    expect(getIconClass('\u26E9\uFE0F')).toBe('flair-icon-glow');
    expect(getIconClass('🦊')).toBe('flair-icon-glow');
  });

  test('each premium icon has its own class', () => {
    expect(getIconClass('🔥')).toBe('flair-icon-flame');
    expect(getIconClass('🌸')).toBe('flair-icon-blossom');
    expect(getIconClass('🎆')).toBe('flair-icon-firework');
    expect(getIconClass('🌊')).toBe('flair-icon-wave');
    expect(getIconClass('🥷')).toBe('flair-icon-ninja');
  });

  test('entry and unknown icons have no class', () => {
    expect(getIconClass('🍙')).toBe('');
    expect(getIconClass('🤖')).toBe('');
    expect(getIconStyle('🤖')).toBeNull();
  });
});

describe('getNameColorStyle', () => {
  test.each([
    ['flair-color-pink', 'entry'],
    ['flair-color-teal', 'entry'],
    ['flair-color-amber', 'entry'],
    ['flair-color-matcha', 'entry'],
    ['flair-color-aizome', 'entry'],
    ['flair-color-umeboshi', 'entry'],
    ['flair-color-sumi', 'entry'],
    ['flair-color-emerald', 'mid'],
    ['flair-color-blue', 'mid'],
    ['flair-color-purple', 'mid'],
    ['flair-color-fuji', 'mid'],
    ['flair-color-moonlit', 'mid'],
    ['flair-color-red', 'premium'],
    ['flair-color-gold', 'premium'],
    ['flair-color-neon', 'premium'],
    ['flair-color-tanabata', 'premium'],
  ])('%s is %s tier', (value, tier) => {
    expect(getNameColorStyle(value)?.tier).toBe(tier);
  });

  test('only premium colors have a sparkle palette', () => {
    expect(getNameColorStyle('flair-color-gold')?.sparkleClass).toBe('flair-sparkles-gold');
    expect(getNameColorStyle('flair-color-red')?.sparkleClass).toBe('flair-sparkles-crimson');
    expect(getNameColorStyle('flair-color-neon')?.sparkleClass).toBe('flair-sparkles-neon');
    expect(getNameColorStyle('flair-color-tanabata')?.sparkleClass).toBe('flair-sparkles-tanabata');
    expect(getNameColorStyle('flair-color-fuji')?.sparkleClass).toBeUndefined();
    expect(getNameColorStyle('flair-color-pink')?.sparkleClass).toBeUndefined();
  });

  test('returns null for legacy or unknown values', () => {
    expect(getNameColorStyle('text-emerald-600')).toBeNull();
    expect(getNameColorStyle('')).toBeNull();
  });
});

describe('isFlairEquipped', () => {
  const equipped = {
    nameColor: 'flair-color-pink',
    nameIcon: null,
    profileBorder: null,
    title: 'Nakama',
  };

  test('is true when the slot holds the item value', () => {
    expect(isFlairEquipped(equipped, { category: 'nameColor', value: 'flair-color-pink' })).toBe(true);
    expect(isFlairEquipped(equipped, { category: 'title', value: 'Nakama' })).toBe(true);
  });

  test('is false for a different value, an empty slot, or another category', () => {
    expect(isFlairEquipped(equipped, { category: 'nameColor', value: 'flair-color-teal' })).toBe(false);
    expect(isFlairEquipped(equipped, { category: 'nameIcon', value: '🍙' })).toBe(false);
    expect(isFlairEquipped(equipped, { category: 'title', value: 'flair-color-pink' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="utils/__tests__/flairUtils"`
Expected: FAIL. TypeScript/Jest reports that `getTitleStyle`, `getIconStyle`, `getIconClass`, `getNameColorStyle` and `isFlairEquipped` are not exported from `../flairUtils`.

- [ ] **Step 3: Rewrite `client/src/utils/flairUtils.ts`**

Replace the entire file with:

```ts
import type { EquippedFlair, ShopItem } from '../services/api';

export type FlairTier = 'entry' | 'mid' | 'premium';

export interface TitleStyle {
  tier: FlairTier;
  className: string;
  emoji?: string;
}

export interface IconStyle {
  tier: FlairTier;
  className: string;
}

export interface NameColorStyle {
  tier: FlairTier;
  sparkleClass?: string;
}

// The three tables below are the client-side source of truth for flair identity strings.
// Keys are the `value` strings the server stores in User.equippedFlair, so a key must
// never be renamed for an item that already exists.

const ENTRY_TITLE: TitleStyle = { tier: 'entry', className: '' };
const MID_TITLE: TitleStyle = { tier: 'mid', className: 'flair-title-mid' };

const TITLE_STYLES: Record<string, TitleStyle> = {
  'Regular': ENTRY_TITLE,
  'Tenpai': ENTRY_TITLE,
  'Nakama': ENTRY_TITLE,
  'Chi Chi': ENTRY_TITLE,
  'PonPonPon': ENTRY_TITLE,
  'Kan I Help You?': ENTRY_TITLE,
  'East Wind': MID_TITLE,
  'Dragon Slayer': MID_TITLE,
  'Dora Hunter': MID_TITLE,
  'Power of Friendship': MID_TITLE,
  'Over 9000 Han': MID_TITLE,
  'Chicken Farmer': { tier: 'premium', className: 'flair-title-chicken', emoji: '🐔' },
  'Chombo Chaser': { tier: 'premium', className: 'flair-title-chombo', emoji: '⚡' },
  'Tsumo-nami': { tier: 'premium', className: 'flair-title-tsumonami', emoji: '🌊' },
};

const ENTRY_ICON: IconStyle = { tier: 'entry', className: '' };
const MID_ICON: IconStyle = { tier: 'mid', className: 'flair-icon-glow' };

const ICON_STYLES: Record<string, IconStyle> = {
  '🏮': ENTRY_ICON,
  '🀄': ENTRY_ICON,
  '⭐': ENTRY_ICON,
  '🍙': ENTRY_ICON,
  '🍡': ENTRY_ICON,
  '🎴': ENTRY_ICON,
  '🎐': ENTRY_ICON,
  '🎋': MID_ICON,
  '👑': MID_ICON,
  '🐉': MID_ICON,
  // Torii gate is stored with its emoji variation selector (U+FE0F); the key must match exactly.
  '\u26E9\uFE0F': MID_ICON,
  '🦊': MID_ICON,
  '🔥': { tier: 'premium', className: 'flair-icon-flame' },
  '🌸': { tier: 'premium', className: 'flair-icon-blossom' },
  '🎆': { tier: 'premium', className: 'flair-icon-firework' },
  '🌊': { tier: 'premium', className: 'flair-icon-wave' },
  '🥷': { tier: 'premium', className: 'flair-icon-ninja' },
};

const ENTRY_COLOR: NameColorStyle = { tier: 'entry' };
const MID_COLOR: NameColorStyle = { tier: 'mid' };

const NAME_COLOR_STYLES: Record<string, NameColorStyle> = {
  'flair-color-pink': ENTRY_COLOR,
  'flair-color-teal': ENTRY_COLOR,
  'flair-color-amber': ENTRY_COLOR,
  'flair-color-matcha': ENTRY_COLOR,
  'flair-color-aizome': ENTRY_COLOR,
  'flair-color-umeboshi': ENTRY_COLOR,
  'flair-color-sumi': ENTRY_COLOR,
  'flair-color-emerald': MID_COLOR,
  'flair-color-blue': MID_COLOR,
  'flair-color-purple': MID_COLOR,
  'flair-color-fuji': MID_COLOR,
  'flair-color-moonlit': MID_COLOR,
  'flair-color-gold': { tier: 'premium', sparkleClass: 'flair-sparkles-gold' },
  'flair-color-red': { tier: 'premium', sparkleClass: 'flair-sparkles-crimson' },
  'flair-color-neon': { tier: 'premium', sparkleClass: 'flair-sparkles-neon' },
  'flair-color-tanabata': { tier: 'premium', sparkleClass: 'flair-sparkles-tanabata' },
};

// hasOwnProperty guard: values come from the server, and a plain object lookup
// would return inherited members for keys like 'constructor'.
function lookup<T>(table: Record<string, T>, key: string): T | null {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
}

export function isPremiumBorder(borderValue: string): boolean {
  return borderValue.startsWith('flair-border-');
}

export function isMidTierBorder(borderValue: string): boolean {
  return borderValue.startsWith('flair-mid-');
}

export function getTitleStyle(titleValue: string): TitleStyle | null {
  return lookup(TITLE_STYLES, titleValue);
}

export function getPremiumTitleClass(titleValue: string): string {
  const style = getTitleStyle(titleValue);
  return style?.tier === 'premium' ? style.className : '';
}

export function getPremiumTitleEmoji(titleValue: string): string {
  const style = getTitleStyle(titleValue);
  return style?.tier === 'premium' ? style.emoji ?? '' : '';
}

export function getMidTierTitleClass(titleValue: string): string {
  const style = getTitleStyle(titleValue);
  return style?.tier === 'mid' ? style.className : '';
}

export function getIconStyle(iconValue: string): IconStyle | null {
  return lookup(ICON_STYLES, iconValue);
}

export function getIconClass(iconValue: string): string {
  return getIconStyle(iconValue)?.className ?? '';
}

export function getNameColorStyle(colorValue: string): NameColorStyle | null {
  return lookup(NAME_COLOR_STYLES, colorValue);
}

// The server stores the item's `value` (not its id) in User.equippedFlair.
export function isFlairEquipped(
  equippedFlair: EquippedFlair,
  item: Pick<ShopItem, 'category' | 'value'>
): boolean {
  return equippedFlair[item.category] === item.value;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="utils/__tests__/flairUtils"`
Expected: PASS (all describe blocks, including the two original ones).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/flairUtils.ts client/src/utils/__tests__/flairUtils.test.ts
git commit -m "feat: data-driven flair style registry" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Shared server catalog module + integrity test

**Files:**
- Create: `server/src/data/shopCatalog.js`
- Test: `server/src/data/shopCatalog.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/src/data/shopCatalog.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx jest src/data/shopCatalog.test.js`
Expected: FAIL with `Cannot find module './shopCatalog'`.

- [ ] **Step 3: Create `server/src/data/shopCatalog.js`**

```js
// Single source of truth for the flair shop catalog. Used by scripts/seedShop.js and by
// POST /api/shop/seed. The seed matches items by `name`, so names must be unique across
// all categories. `value` is copied onto User.equippedFlair at equip time, so the `value`
// of an existing item must never change.
//
// sortOrder is per category and lists entry, then mid, then premium.

const SHOP_CATALOG = [
  // nameColor — 16 items
  { name: 'Sakura Pink',    description: 'Delicate cherry blossom pink',           category: 'nameColor', cost: 50,  tier: 'entry',   value: 'flair-color-pink',     sortOrder: 1 },
  { name: 'Sea Teal',       description: 'Inspired by the East China Sea',          category: 'nameColor', cost: 50,  tier: 'entry',   value: 'flair-color-teal',     sortOrder: 2 },
  { name: 'Matcha',         description: 'Whisked green tea',                       category: 'nameColor', cost: 50,  tier: 'entry',   value: 'flair-color-matcha',   sortOrder: 3 },
  { name: 'Aizome',         description: 'Traditional indigo dye',                  category: 'nameColor', cost: 50,  tier: 'entry',   value: 'flair-color-aizome',   sortOrder: 4 },
  { name: 'Amber',          description: 'Warm amber glow',                         category: 'nameColor', cost: 75,  tier: 'entry',   value: 'flair-color-amber',    sortOrder: 5 },
  { name: 'Umeboshi',       description: 'Pickled sour plum',                       category: 'nameColor', cost: 75,  tier: 'entry',   value: 'flair-color-umeboshi', sortOrder: 6 },
  { name: 'Sumi Ink',       description: 'Calligraphy ink, understated',            category: 'nameColor', cost: 75,  tier: 'entry',   value: 'flair-color-sumi',     sortOrder: 7 },
  { name: 'Jade Green',     description: 'Classic jade green',                      category: 'nameColor', cost: 125, tier: 'mid',     value: 'flair-color-emerald',  sortOrder: 8 },
  { name: 'Ocean Blue',     description: 'A deep ocean blue',                       category: 'nameColor', cost: 125, tier: 'mid',     value: 'flair-color-blue',     sortOrder: 9 },
  { name: 'Fuji Sunset',    description: 'The dusk sky behind the mountain',        category: 'nameColor', cost: 125, tier: 'mid',     value: 'flair-color-fuji',     sortOrder: 10 },
  { name: 'Royal Purple',   description: 'Regal and commanding',                    category: 'nameColor', cost: 150, tier: 'mid',     value: 'flair-color-purple',   sortOrder: 11 },
  { name: 'Moonlit Bamboo', description: 'A bamboo grove under the moon',           category: 'nameColor', cost: 150, tier: 'mid',     value: 'flair-color-moonlit',  sortOrder: 12 },
  { name: 'Crimson Dragon', description: 'The fierce red of a dragon',              category: 'nameColor', cost: 300, tier: 'premium', value: 'flair-color-red',      sortOrder: 13 },
  { name: 'Mahjong Gold',   description: 'The golden color of a winning hand',      category: 'nameColor', cost: 300, tier: 'premium', value: 'flair-color-gold',     sortOrder: 14 },
  { name: 'Neon Akihabara', description: 'Electric-town lights, flowing',           category: 'nameColor', cost: 300, tier: 'premium', value: 'flair-color-neon',     sortOrder: 15 },
  { name: 'Tanabata Stars', description: 'Midnight blue to starlight, twinkling',   category: 'nameColor', cost: 300, tier: 'premium', value: 'flair-color-tanabata', sortOrder: 16 },

  // nameIcon — 17 items
  { name: 'Red Lantern',    description: 'A traditional festival lantern',          category: 'nameIcon', cost: 50,  tier: 'entry',   value: '🏮', sortOrder: 1 },
  { name: 'Mahjong Tile',   description: 'The iconic mahjong tile',                 category: 'nameIcon', cost: 50,  tier: 'entry',   value: '🀄', sortOrder: 2 },
  { name: 'Onigiri',        description: 'The rice ball that fuels every protagonist', category: 'nameIcon', cost: 50, tier: 'entry', value: '🍙', sortOrder: 3 },
  { name: 'Dango',          description: 'Sweet dumplings on a stick',              category: 'nameIcon', cost: 50,  tier: 'entry',   value: '🍡', sortOrder: 4 },
  { name: 'Lucky Star',     description: 'For lucky players',                       category: 'nameIcon', cost: 75,  tier: 'entry',   value: '⭐', sortOrder: 5 },
  { name: 'Hanafuda',       description: 'Japanese flower cards',                   category: 'nameIcon', cost: 75,  tier: 'entry',   value: '🎴', sortOrder: 6 },
  { name: 'Furin',          description: 'A summer wind chime',                     category: 'nameIcon', cost: 75,  tier: 'entry',   value: '🎐', sortOrder: 7 },
  { name: 'Bamboo',         description: 'A lucky bamboo stalk',                    category: 'nameIcon', cost: 100, tier: 'mid',     value: '🎋', sortOrder: 8 },
  { name: 'Crown',          description: 'Royalty at the table',                    category: 'nameIcon', cost: 125, tier: 'mid',     value: '👑', sortOrder: 9 },
  { name: 'Torii Gate',     description: 'The entrance to a shrine',                category: 'nameIcon', cost: 125, tier: 'mid',     value: '\u26E9\uFE0F', sortOrder: 10 },
  { name: 'Dragon',         description: 'A fearsome dragon',                       category: 'nameIcon', cost: 150, tier: 'mid',     value: '🐉', sortOrder: 11 },
  { name: 'Kitsune',        description: 'The fox spirit and shrine messenger',     category: 'nameIcon', cost: 150, tier: 'mid',     value: '🦊', sortOrder: 12 },
  { name: 'Flame',          description: 'You are on fire',                         category: 'nameIcon', cost: 250, tier: 'premium', value: '🔥', sortOrder: 13 },
  { name: 'Cherry Blossom', description: 'A delicate sakura bloom',                 category: 'nameIcon', cost: 300, tier: 'premium', value: '🌸', sortOrder: 14 },
  { name: 'Firework',       description: 'Bursts outward and pulses, glow shifting pink to gold', category: 'nameIcon', cost: 300, tier: 'premium', value: '🎆', sortOrder: 15 },
  { name: 'Great Wave',     description: 'Rolls and crests with a sea-blue glow',   category: 'nameIcon', cost: 300, tier: 'premium', value: '🌊', sortOrder: 16 },
  { name: 'Ninja',          description: 'Blurs out, then reappears with a flash',  category: 'nameIcon', cost: 300, tier: 'premium', value: '🥷', sortOrder: 17 },

  // profileBorder — 16 items
  { name: 'Blush',         description: 'A soft pink ring',                         category: 'profileBorder', cost: 50,  tier: 'entry',   value: 'flair-ring-blush',     sortOrder: 1 },
  { name: 'Pebble',        description: 'A simple stone-grey ring',                 category: 'profileBorder', cost: 50,  tier: 'entry',   value: 'flair-ring-pebble',    sortOrder: 2 },
  { name: 'Manzu',         description: 'The characters suit, in tile red',         category: 'profileBorder', cost: 50,  tier: 'entry',   value: 'flair-ring-manzu',     sortOrder: 3 },
  { name: 'Pinzu',         description: 'The circles suit, in dot blue',            category: 'profileBorder', cost: 50,  tier: 'entry',   value: 'flair-ring-pinzu',     sortOrder: 4 },
  { name: 'Souzu',         description: 'The bamboo suit, in stalk green',          category: 'profileBorder', cost: 75,  tier: 'entry',   value: 'flair-ring-souzu',     sortOrder: 5 },
  { name: 'Persimmon',     description: 'The orange of an autumn kaki',             category: 'profileBorder', cost: 75,  tier: 'entry',   value: 'flair-ring-persimmon', sortOrder: 6 },
  { name: 'Jade Ring',     description: 'Rich jade border',                         category: 'profileBorder', cost: 125, tier: 'mid',     value: 'flair-mid-jade',       sortOrder: 7 },
  { name: 'Cobalt Ring',   description: 'Deep cobalt border',                       category: 'profileBorder', cost: 125, tier: 'mid',     value: 'flair-mid-cobalt',     sortOrder: 8 },
  { name: 'Torii Ring',    description: 'Shrine-gate vermilion, deepening to burnt red', category: 'profileBorder', cost: 125, tier: 'mid', value: 'flair-mid-torii',     sortOrder: 9 },
  { name: 'Sakura Ring',   description: 'Cherry blossom pink border',               category: 'profileBorder', cost: 150, tier: 'mid',     value: 'flair-mid-sakura',     sortOrder: 10 },
  { name: 'Wisteria Ring', description: 'Fuji blossoms, lavender to deep violet',   category: 'profileBorder', cost: 150, tier: 'mid',     value: 'flair-mid-wisteria',   sortOrder: 11 },
  { name: 'Rainbow Halo',  description: 'Slowly spinning rainbow conic gradient',   category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-rainbow', sortOrder: 12 },
  { name: 'Dragon Scale',  description: 'Spinning emerald gradient — shimmering scales', category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-dragon', sortOrder: 13 },
  { name: 'Hanabi',        description: 'Fireworks circling in the night sky',      category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-hanabi',  sortOrder: 14 },
  { name: 'Kitsune Fire',  description: 'Fox fire, spinning the other way',         category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-kitsune', sortOrder: 15 },
  { name: 'Yozakura',      description: 'Night cherry blossoms in the dark',        category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-yozakura', sortOrder: 16 },

  // title — 14 items
  { name: 'Regular',             description: 'A familiar face at the table',                        category: 'title', cost: 50,  tier: 'entry',   value: 'Regular',             sortOrder: 1 },
  { name: 'Nakama',              description: 'Your crew, your comrades, your table',                category: 'title', cost: 50,  tier: 'entry',   value: 'Nakama',              sortOrder: 2 },
  { name: 'Chi Chi',             description: 'Calling a run, named after the Dragon Ball mom',      category: 'title', cost: 50,  tier: 'entry',   value: 'Chi Chi',             sortOrder: 3 },
  { name: 'Tenpai',              description: 'Always one tile away from winning',                   category: 'title', cost: 75,  tier: 'entry',   value: 'Tenpai',              sortOrder: 4 },
  { name: 'PonPonPon',           description: 'Triplet call, Harajuku beat',                         category: 'title', cost: 75,  tier: 'entry',   value: 'PonPonPon',           sortOrder: 5 },
  { name: 'Kan I Help You?',     description: 'A quad-calling customer service specialist',          category: 'title', cost: 75,  tier: 'entry',   value: 'Kan I Help You?',     sortOrder: 6 },
  { name: 'East Wind',           description: "The dealer's seat — a position of prestige",          category: 'title', cost: 125, tier: 'mid',     value: 'East Wind',           sortOrder: 7 },
  { name: 'Power of Friendship', description: 'The trope that wins every final arc',                 category: 'title', cost: 125, tier: 'mid',     value: 'Power of Friendship', sortOrder: 8 },
  { name: 'Dragon Slayer',       description: 'Defeated more than a few big hands',                  category: 'title', cost: 150, tier: 'mid',     value: 'Dragon Slayer',       sortOrder: 9 },
  { name: 'Dora Hunter',         description: 'Always chasing bonus tiles',                          category: 'title', cost: 175, tier: 'mid',     value: 'Dora Hunter',         sortOrder: 10 },
  { name: 'Over 9000 Han',       description: 'The scouter says this hand is worth more than 9000 han', category: 'title', cost: 175, tier: 'mid',  value: 'Over 9000 Han',       sortOrder: 11 },
  { name: 'Chicken Farmer',      description: "Wins without a single yaku. Honkaku's nemesis.",      category: 'title', cost: 300, tier: 'premium', value: 'Chicken Farmer',      sortOrder: 12 },
  { name: 'Chombo Chaser',       description: 'A dedicated student of the penalty sheet.',           category: 'title', cost: 300, tier: 'premium', value: 'Chombo Chaser',       sortOrder: 13 },
  { name: 'Tsumo-nami',          description: 'A self-drawn win that hits like a wave',              category: 'title', cost: 300, tier: 'premium', value: 'Tsumo-nami',          sortOrder: 14 },
];

module.exports = { SHOP_CATALOG };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && npx jest src/data/shopCatalog.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/data/shopCatalog.js server/src/data/shopCatalog.test.js
git commit -m "feat: shared 63-item shop catalog with halved prices" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Seed script and seed route use the shared catalog

**Files:**
- Rewrite: `server/scripts/seedShop.js`
- Modify: `server/src/routes/shop.js` (delete lines 119-158, then edit two references and one import)
- Test: `server/src/routes/shop.test.js` (append)

- [ ] **Step 1: Write the failing route test**

In `server/src/routes/shop.test.js`, add this line after line 15 (`const ShopItem = require('../models/ShopItem');`):

```js
const { SHOP_CATALOG } = require('../data/shopCatalog');
```

Append to the end of the file:

```js
describe('POST /api/shop/seed', () => {
  test('returns 403 for non-admin users', async () => {
    const res = await request(app).post('/api/shop/seed');

    expect(res.status).toBe(403);
  });

  test('seeds the shared catalog with the current prices', async () => {
    const adminApp = buildTestApp({ _id: user._id, isAdmin: true });

    const res = await request(adminApp).post('/api/shop/seed');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(SHOP_CATALOG.length);

    const jade = await ShopItem.findOne({ name: 'Jade Green' });
    expect(jade.cost).toBe(125);
    expect(jade.value).toBe('flair-color-emerald');
    const hanabi = await ShopItem.findOne({ name: 'Hanabi' });
    expect(hanabi.tier).toBe('premium');
    expect(hanabi.value).toBe('flair-border-hanabi');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx jest src/routes/shop.test.js -t "POST /api/shop/seed"`
Expected: the "seeds the shared catalog" test FAILS (the route still seeds its stale 27-item list, so `count` is wrong and Hanabi is missing). Needs MongoDB; if unavailable, report that and continue.

- [ ] **Step 3: Delete the stale list from the route**

Run (lines 119-158 are `const SEED_ITEMS = [` through the closing `];` and the blank line after it; verify with `sed -n '119p;157,158p' server/src/routes/shop.js` first, expecting `const SEED_ITEMS = [`, `];`, and an empty line):

```bash
sed -n '119p;157,158p' server/src/routes/shop.js
sed -i '119,158d' server/src/routes/shop.js
sed -i 's/SEED_ITEMS/SHOP_CATALOG/g' server/src/routes/shop.js
```

Then in `server/src/routes/shop.js` add the import after line 4 (`const { spendPoints } = require('../utils/pointsService');`):

```js
const { SHOP_CATALOG } = require('../data/shopCatalog');
```

Verify: `grep -n "SEED_ITEMS\|SHOP_CATALOG" server/src/routes/shop.js` should show only the import and the two uses inside `router.post('/seed', ...)`.

- [ ] **Step 4: Rewrite `server/scripts/seedShop.js`**

```js
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ShopItem = require('../src/models/ShopItem');
const { SHOP_CATALOG } = require('../src/data/shopCatalog');

async function seedShop() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const catalogNames = SHOP_CATALOG.map(item => item.name);

  const deactivated = await ShopItem.updateMany(
    { name: { $nin: catalogNames } },
    { $set: { isActive: false } }
  );
  if (deactivated.modifiedCount > 0) {
    console.log(`Deactivated ${deactivated.modifiedCount} removed item(s)`);
  }

  let created = 0;
  let updated = 0;

  for (const { name, category, cost, tier, description, value, sortOrder } of SHOP_CATALOG) {
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
```

**Do not run this script.** Seeding the real database is a rollout step for the user (see Task 13).

- [ ] **Step 5: Run the server tests**

Run: `cd server && npx jest src/data src/routes/shop.test.js`
Expected: PASS (catalog test, plus all route tests including both seed tests; needs MongoDB).

- [ ] **Step 6: Commit**

```bash
git add server/scripts/seedShop.js server/src/routes/shop.js server/src/routes/shop.test.js
git commit -m "refactor: seed script and route share one catalog module" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Rewrite `flair.css`, driven by a catalog ↔ registry ↔ CSS cross-check

**Files:**
- Create: `client/src/utils/__tests__/flairCatalog.test.ts`
- Rewrite: `client/src/styles/flair.css`

- [ ] **Step 1: Write the failing cross-check test**

Create `client/src/utils/__tests__/flairCatalog.test.ts`:

```ts
import fs from 'fs';
import path from 'path';
import {
  getTitleStyle,
  getIconStyle,
  getNameColorStyle,
  isPremiumBorder,
  isMidTierBorder,
} from '../flairUtils';

// Reads the server catalog directly so the two packages cannot drift apart.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SHOP_CATALOG } = require('../../../../server/src/data/shopCatalog');

interface CatalogItem {
  name: string;
  category: string;
  tier: string;
  value: string;
}

const css = fs.readFileSync(path.join(__dirname, '../../styles/flair.css'), 'utf8');

const cssDefines = (className: string): boolean =>
  new RegExp(`\\.${className}(?![\\w-])`).test(css);

const itemsIn = (category: string): CatalogItem[] =>
  SHOP_CATALOG.filter((item: CatalogItem) => item.category === category);

// test.each rows: [display name, item]. The tuple type keeps `item` typed under strict mode.
const rowsIn = (category: string): Array<[string, CatalogItem]> =>
  itemsIn(category).map((item): [string, CatalogItem] => [item.name, item]);

describe('shop catalog ↔ client registry ↔ flair.css', () => {
  test.each(rowsIn('title'))('title %s is registered at its catalog tier', (_name, item) => {
    const style = getTitleStyle(item.value);
    expect(style?.tier).toBe(item.tier);
    if (style?.className) {
      expect(cssDefines(style.className)).toBe(true);
    }
  });

  test.each(rowsIn('nameIcon'))('icon %s is registered at its catalog tier', (_name, item) => {
    const style = getIconStyle(item.value);
    expect(style?.tier).toBe(item.tier);
    if (style?.className) {
      expect(cssDefines(style.className)).toBe(true);
    }
  });

  test.each(rowsIn('nameColor'))('name color %s is registered and styled', (_name, item) => {
    const style = getNameColorStyle(item.value);
    expect(style?.tier).toBe(item.tier);
    expect(cssDefines(item.value)).toBe(true);
    if (item.tier === 'premium') {
      expect(style?.sparkleClass).toBeDefined();
      expect(cssDefines(style?.sparkleClass as string)).toBe(true);
    } else {
      expect(style?.sparkleClass).toBeUndefined();
    }
  });

  test.each(rowsIn('profileBorder'))('border %s has a class matching its tier', (_name, item) => {
    expect(cssDefines(item.value)).toBe(true);
    expect(isPremiumBorder(item.value)).toBe(item.tier === 'premium');
    expect(isMidTierBorder(item.value)).toBe(item.tier === 'mid');
  });

  test('sparkle overlay classes exist', () => {
    ['flair-sparkle-wrap', 'flair-sparkle', 'flair-sparkle-tr', 'flair-sparkle-bl', 'flair-sparkle-tm'].forEach(cls => {
      expect(cssDefines(cls)).toBe(true);
    });
  });

  test('the premium ring spins a ::before layer, not the avatar wrapper', () => {
    expect(css).toMatch(/\.flair-border-hanabi::before/);
    expect(css).not.toMatch(/\.flair-border-[a-z]+\s*\{[^}]*animation:/);
  });

  test('reduced-motion rules are present', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="utils/__tests__/flairCatalog"`
Expected: FAIL. Many cases report missing CSS classes (`flair-ring-manzu`, `flair-mid-torii`, `flair-border-hanabi`, `flair-color-matcha`, `flair-icon-glow`, `flair-sparkle-wrap`, ...). If instead the whole suite fails with `Cannot find module '../../../../server/src/data/shopCatalog'`, or a syntax error from Jest's transform, stop and report it to the user: CRA's Jest setup cannot import the server module and the spec's fallback (a shared fixture list of values) needs a decision.

- [ ] **Step 3: Rewrite `client/src/styles/flair.css`**

Replace the entire file with:

```css
/* ==========================================================================
   Flair styles. Class names are the `value` strings stored on users
   (see server/src/data/shopCatalog.js) and must not be renamed for existing items.
   Design rules: docs/flair-style-guide.md
   ========================================================================== */

@keyframes flair-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes flair-flow {
  from { background-position: 0% 50%; }
  to   { background-position: 300% 50%; }
}

@keyframes flair-twinkle {
  0%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg); }
  40%, 60% { opacity: 1; transform: scale(1) rotate(25deg); }
}

@keyframes flair-flicker {
  0%, 100% { transform: scale(1) rotate(-3deg); filter: drop-shadow(0 0 4px #f97316) brightness(1); }
  30%      { transform: scale(1.12) rotate(3deg) translateY(-1px); filter: drop-shadow(0 0 9px #fbbf24) brightness(1.15); }
  60%      { transform: scale(0.96) rotate(-2deg); filter: drop-shadow(0 0 5px #f97316) brightness(1.05); }
}

@keyframes flair-sway {
  0%, 100% { transform: rotate(-9deg) translateY(0); }
  50%      { transform: rotate(9deg) translateY(-2px); }
}

@keyframes flair-burst {
  0%, 100% { transform: scale(0.92); filter: drop-shadow(0 0 3px #f472b6) hue-rotate(0deg); }
  50%      { transform: scale(1.18); filter: drop-shadow(0 0 10px #facc15) hue-rotate(40deg) brightness(1.15); }
}

@keyframes flair-roll {
  0%, 100% { transform: translateY(1px) rotate(-7deg) skewX(-4deg); }
  50%      { transform: translateY(-3px) rotate(7deg) skewX(4deg); }
}

@keyframes flair-vanish {
  0%, 58%, 100% { opacity: 1; transform: translateX(0); filter: drop-shadow(0 0 5px rgba(99, 102, 241, 0.8)) blur(0); }
  64%           { opacity: 0.08; transform: translateX(8px); filter: blur(2px); }
  72%           { opacity: 0.08; transform: translateX(-8px); filter: blur(2px); }
  80%           { opacity: 1; transform: translateX(0) scale(1.15); filter: drop-shadow(0 0 9px rgba(99, 102, 241, 1)) blur(0); }
}

/* ==========================================================================
   Profile borders
   ========================================================================== */

/* Entry: flat ring applied directly to the avatar element */
.flair-ring-blush     { box-shadow: 0 0 0 2px #f9a8d4; }
.flair-ring-pebble    { box-shadow: 0 0 0 2px #9ca3af; }
.flair-ring-manzu     { box-shadow: 0 0 0 2px #ef4444; }
.flair-ring-pinzu     { box-shadow: 0 0 0 2px #38bdf8; }
.flair-ring-souzu     { box-shadow: 0 0 0 2px #22c55e; }
.flair-ring-persimmon { box-shadow: 0 0 0 2px #fb923c; }

/* Mid: static multi-stop gradient wrapper */
.flair-mid-jade,
.flair-mid-cobalt,
.flair-mid-sakura,
.flair-mid-torii,
.flair-mid-wisteria {
  position: relative;
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
}

.flair-mid-jade     { background: linear-gradient(135deg, #10b981, #059669, #34d399, #065f46, #10b981); }
.flair-mid-cobalt   { background: linear-gradient(135deg, #3b82f6, #1d4ed8, #93c5fd, #1e40af, #3b82f6); }
.flair-mid-sakura   { background: linear-gradient(135deg, #f472b6, #ec4899, #fbcfe8, #be185d, #f472b6); }
.flair-mid-torii    { background: linear-gradient(135deg, #ef4444, #dc2626, #fb923c, #991b1b, #ef4444); }
.flair-mid-wisteria { background: linear-gradient(135deg, #a78bfa, #7c3aed, #ddd6fe, #5b21b6, #a78bfa); }

/* Premium: spinning conic-gradient ring. Only the ::before layer rotates; the avatar
   (.flair-border-inner) sits above it and stays still. */
.flair-border-rainbow,
.flair-border-dragon,
.flair-border-hanabi,
.flair-border-kitsune,
.flair-border-yozakura {
  position: relative;
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
}

.flair-border-rainbow::before,
.flair-border-dragon::before,
.flair-border-hanabi::before,
.flair-border-kitsune::before,
.flair-border-yozakura::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--flair-conic);
  animation: flair-spin var(--flair-spin-duration, 3s) linear infinite;
  animation-direction: var(--flair-spin-direction, normal);
}

.flair-border-rainbow {
  --flair-conic: conic-gradient(#facc15, #fb923c, #f87171, #e879f9, #818cf8, #34d399, #facc15);
  --flair-spin-duration: 3s;
}

.flair-border-dragon {
  --flair-conic: conic-gradient(#34d399, #059669, #065f46, #059669, #34d399, #6ee7b7, #34d399);
  --flair-spin-duration: 4s;
  --flair-spin-direction: reverse;
}

.flair-border-hanabi {
  --flair-conic: conic-gradient(#1e1b4b, #f472b6, #facc15, #1e1b4b, #38bdf8, #f472b6, #1e1b4b);
  --flair-spin-duration: 3s;
}

.flair-border-kitsune {
  --flair-conic: conic-gradient(#f97316, #fde047, #ffffff, #fde047, #ef4444, #7f1d1d, #f97316);
  --flair-spin-duration: 2.6s;
  --flair-spin-direction: reverse;
}

.flair-border-yozakura {
  --flair-conic: conic-gradient(#f9a8d4, #a78bfa, #1e3a8a, #a78bfa, #f9a8d4, #ffffff, #f9a8d4);
  --flair-spin-duration: 4s;
}

.flair-border-inner {
  position: relative;
  z-index: 1;
  border-radius: 9999px;
  overflow: hidden;
}

/* ==========================================================================
   Name colors
   Entry: flat color. Mid: static two-hue gradient text. Premium: flowing multi-hue
   gradient text plus sparkles. Gradient classes use background-image, never the
   `background:` shorthand, which would reset background-clip: text.
   ========================================================================== */

/* Entry */
.flair-color-pink     { color: #ec4899; }
.flair-color-teal     { color: #0d9488; }
.flair-color-amber    { color: #d97706; }
.flair-color-matcha   { color: #65a30d; }
.flair-color-aizome   { color: #4f46e5; }
.flair-color-umeboshi { color: #be123c; }
.flair-color-sumi     { color: #334155; }

/* Mid + premium share the text-clip mechanics */
.flair-color-emerald,
.flair-color-blue,
.flair-color-purple,
.flair-color-fuji,
.flair-color-moonlit,
.flair-color-gold,
.flair-color-red,
.flair-color-neon,
.flair-color-tanabata {
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

/* Mid */
.flair-color-emerald { background-image: linear-gradient(90deg, #047857, #65a30d); }
.flair-color-blue    { background-image: linear-gradient(90deg, #1e3a8a, #0891b2, #14b8a6); }
.flair-color-purple  { background-image: linear-gradient(90deg, #5b21b6, #9333ea, #ec4899); }
.flair-color-fuji    { background-image: linear-gradient(90deg, #f97316, #c026d3); }
.flair-color-moonlit { background-image: linear-gradient(90deg, #0d9488, #4f46e5); }

/* Premium */
.flair-color-gold     { background-image: linear-gradient(90deg, #b45309, #f59e0b, #fde047, #f59e0b, #b45309); }
.flair-color-red      { background-image: linear-gradient(90deg, #b91c1c, #ef4444, #64748b, #334155, #b91c1c); }
.flair-color-neon     { background-image: linear-gradient(90deg, #0891b2, #22d3ee, #e879f9, #818cf8, #0891b2); }
.flair-color-tanabata { background-image: linear-gradient(90deg, #1e3a8a, #7c3aed, #a5b4fc, #7c3aed, #1e3a8a); }

.flair-color-gold,
.flair-color-red,
.flair-color-neon,
.flair-color-tanabata {
  background-size: 300% 100%;
  animation: flair-flow 4s linear infinite;
}

/* Premium name sparkles: siblings of the clipped name span (not children), so they keep
   their own color. Sized in em so they scale with the name. */
.flair-sparkle-wrap {
  position: relative;
  display: inline-block;
}

.flair-sparkle {
  position: absolute;
  pointer-events: none;
  line-height: 1;
  animation: flair-twinkle 2.4s ease-in-out infinite;
}

.flair-sparkle-tr { top: -0.45em; right: -0.35em; font-size: 0.62em; }
.flair-sparkle-bl { bottom: -0.3em; left: -0.3em; font-size: 0.5em; animation-delay: 0.9s; }
.flair-sparkle-tm { top: -0.5em; left: 38%; font-size: 0.4em; animation-delay: 1.6s; }

.flair-sparkles-gold     { color: #fde047; text-shadow: 0 0 3px #f59e0b, 0 0 6px #f59e0b; }
.flair-sparkles-crimson  { color: #fee2e2; text-shadow: 0 0 3px #dc2626, 0 0 7px #ef4444; }
.flair-sparkles-neon     { color: #a5f3fc; text-shadow: 0 0 3px #06b6d4, 0 0 6px #22d3ee; }
.flair-sparkles-tanabata { color: #e0e7ff; text-shadow: 0 0 3px #6366f1, 0 0 6px #818cf8; }

/* ==========================================================================
   Name icons
   Entry: plain emoji (no class). Mid: soft static golden glow. Premium: the emoji
   moves, with a colored glow.
   ========================================================================== */

.flair-icon,
.flair-icon-glyph {
  display: inline-block;
}

.flair-icon-glow .flair-icon-glyph {
  filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.75));
}

.flair-icon-flame .flair-icon-glyph {
  animation: flair-flicker 1.1s ease-in-out infinite;
  transform-origin: 50% 90%;
}

.flair-icon-blossom .flair-icon-glyph {
  animation: flair-sway 2.6s ease-in-out infinite;
  transform-origin: 50% 20%;
  filter: drop-shadow(0 0 6px rgba(244, 114, 182, 0.8));
}

.flair-icon-firework .flair-icon-glyph {
  animation: flair-burst 1.4s ease-in-out infinite;
}

.flair-icon-wave .flair-icon-glyph {
  animation: flair-roll 2.2s ease-in-out infinite;
  filter: drop-shadow(0 0 6px rgba(14, 165, 233, 0.85));
}

.flair-icon-ninja .flair-icon-glyph {
  animation: flair-vanish 3.4s ease-in-out infinite;
}

/* ==========================================================================
   Title badges (mid shares one silver badge; premium titles each get their own)
   ========================================================================== */

.flair-title-chicken {
  background: linear-gradient(135deg, #fef08a, #fde68a, #fbbf24);
  color: #92400e;
  border: 1px solid #f59e0b;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.flair-title-chombo {
  background: linear-gradient(135deg, #f87171, #e879f9, #c026d3);
  color: white;
  border: 1px solid #ec4899;
  box-shadow: 0 0 8px rgba(232, 121, 249, 0.4);
}

.flair-title-tsumonami {
  background: linear-gradient(135deg, #67e8f9, #0ea5e9, #1e3a8a);
  color: white;
  border: 1px solid #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
}

.flair-title-mid {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1, #94a3b8, #64748b);
  color: #0f172a;
  border: 1px solid #94a3b8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* ==========================================================================
   Reduced motion: stop every flair animation. Premium items keep their static look.
   ========================================================================== */

@media (prefers-reduced-motion: reduce) {
  .flair-border-rainbow::before,
  .flair-border-dragon::before,
  .flair-border-hanabi::before,
  .flair-border-kitsune::before,
  .flair-border-yozakura::before {
    animation: none;
  }

  .flair-color-gold,
  .flair-color-red,
  .flair-color-neon,
  .flair-color-tanabata {
    animation: none;
    background-size: 100% 100%;
  }

  .flair-sparkle {
    animation: none;
    opacity: 0.6;
  }

  .flair-icon-flame .flair-icon-glyph     { animation: none; filter: drop-shadow(0 0 5px #f97316); }
  .flair-icon-blossom .flair-icon-glyph   { animation: none; }
  .flair-icon-firework .flair-icon-glyph  { animation: none; filter: drop-shadow(0 0 6px #f472b6); }
  .flair-icon-wave .flair-icon-glyph      { animation: none; }
  .flair-icon-ninja .flair-icon-glyph     { animation: none; filter: drop-shadow(0 0 5px rgba(99, 102, 241, 0.8)); }
}
```

- [ ] **Step 4: Run the cross-check test to verify it passes**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="utils/__tests__/flairCatalog"`
Expected: PASS. If a specific item fails, the message names it: fix the class name in `flair.css` or the registry entry, not the test.

- [ ] **Step 5: Confirm nothing else referenced the deleted rules**

Run: `grep -rn "flair-ring-jade\|flair-ring-cobalt\|flair-ring-sakura\|flair-spin-reverse" client/src server/src server/scripts`
Expected: no output. (The old ring rules and the reverse keyframes were deleted; direction now comes from `--flair-spin-direction`.)

- [ ] **Step 6: Commit**

```bash
git add client/src/styles/flair.css client/src/utils/__tests__/flairCatalog.test.ts
git commit -m "feat: tiered flair styles, ring-only premium spin, reduced-motion support" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `FlairName` and `FlairIcon` components

**Files:**
- Create: `client/src/components/user/FlairName.tsx`
- Create: `client/src/components/user/FlairIcon.tsx`
- Test: `client/src/components/user/__tests__/FlairName.test.tsx`
- Test: `client/src/components/user/__tests__/FlairIcon.test.tsx`

- [ ] **Step 1: Write the failing `FlairName` tests**

Create `client/src/components/user/__tests__/FlairName.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FlairName from '../FlairName';

// Sparkles are decorative and aria-hidden, so they cannot be found by role or text.
const sparkles = (container: HTMLElement) => container.querySelectorAll('.flair-sparkle');

describe('FlairName', () => {
  test('renders the plain name with no class when nothing is equipped', () => {
    const { container } = render(<FlairName name="Alice" />);

    expect(screen.getByText('Alice')).not.toHaveAttribute('class');
    expect(sparkles(container)).toHaveLength(0);
  });

  test('applies the default color class when no color is equipped', () => {
    render(<FlairName name="Alice" colorValue={null} defaultColorClass="text-gray-900" />);

    expect(screen.getByText('Alice')).toHaveClass('text-gray-900');
  });

  test('the equipped color replaces the default color class', () => {
    render(<FlairName name="Alice" colorValue="flair-color-pink" defaultColorClass="text-gray-900" />);

    const name = screen.getByText('Alice');
    expect(name).toHaveClass('flair-color-pink');
    expect(name).not.toHaveClass('text-gray-900');
  });

  test('entry and mid colors render no sparkles', () => {
    const entry = render(<FlairName name="Alice" colorValue="flair-color-matcha" />);
    expect(sparkles(entry.container)).toHaveLength(0);
    entry.unmount();

    const mid = render(<FlairName name="Alice" colorValue="flair-color-fuji" />);
    expect(screen.getByText('Alice')).toHaveClass('flair-color-fuji');
    expect(sparkles(mid.container)).toHaveLength(0);
  });

  test('premium colors render three aria-hidden sparkles in their palette', () => {
    const { container } = render(<FlairName name="Alice" colorValue="flair-color-gold" />);

    const name = screen.getByText('Alice');
    expect(name).toHaveClass('flair-color-gold');
    expect(name.closest('.flair-sparkle-wrap')).toBeInTheDocument();

    const found = sparkles(container);
    expect(found).toHaveLength(3);
    found.forEach(sparkle => {
      expect(sparkle).toHaveAttribute('aria-hidden', 'true');
      expect(sparkle).toHaveClass('flair-sparkles-gold');
      expect(sparkle).toHaveTextContent('✦');
    });
  });

  test('sparkles are siblings of the gradient span, never children of it', () => {
    render(<FlairName name="Alice" colorValue="flair-color-neon" />);

    expect(screen.getByText('Alice').querySelector('.flair-sparkle')).toBeNull();
  });

  test.each([
    ['flair-color-gold', 'flair-sparkles-gold'],
    ['flair-color-red', 'flair-sparkles-crimson'],
    ['flair-color-neon', 'flair-sparkles-neon'],
    ['flair-color-tanabata', 'flair-sparkles-tanabata'],
  ])('%s uses the %s sparkle palette', (colorValue, palette) => {
    const { container } = render(<FlairName name="Alice" colorValue={colorValue} />);

    expect(container.querySelector('.flair-sparkle')).toHaveClass(palette);
  });

  test('compact mode drops the top-middle sparkle', () => {
    const { container } = render(<FlairName name="Alice" colorValue="flair-color-gold" compact />);

    expect(sparkles(container)).toHaveLength(2);
    expect(container.querySelector('.flair-sparkle-tm')).toBeNull();
  });

  test('unknown legacy color values are applied as-is without sparkles', () => {
    const { container } = render(<FlairName name="Alice" colorValue="text-emerald-600" />);

    expect(screen.getByText('Alice')).toHaveClass('text-emerald-600');
    expect(sparkles(container)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Write the failing `FlairIcon` tests**

Create `client/src/components/user/__tests__/FlairIcon.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FlairIcon from '../FlairIcon';

describe('FlairIcon', () => {
  test('wraps the emoji in an aria-hidden span', () => {
    render(<FlairIcon value="🐉" />);

    const glyph = screen.getByText('🐉');
    expect(glyph).toHaveClass('flair-icon-glyph');
    expect(glyph.parentElement).toHaveClass('flair-icon');
    expect(glyph.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  test('entry icons get no tier class', () => {
    render(<FlairIcon value="🍙" />);

    expect(screen.getByText('🍙').parentElement).toHaveAttribute('class', 'flair-icon');
  });

  test('mid icons get the shared glow class', () => {
    render(<FlairIcon value="🦊" />);

    expect(screen.getByText('🦊').parentElement).toHaveClass('flair-icon-glow');
  });

  test('premium icons get their own class', () => {
    render(<FlairIcon value="🥷" />);

    expect(screen.getByText('🥷').parentElement).toHaveClass('flair-icon-ninja');
  });

  test('appends extra classes from the caller', () => {
    render(<FlairIcon value="🔥" className="mr-1 text-sm" />);

    const wrapper = screen.getByText('🔥').parentElement;
    expect(wrapper).toHaveClass('flair-icon', 'flair-icon-flame', 'mr-1', 'text-sm');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="components/user/__tests__/Flair(Name|Icon)"`
Expected: FAIL with `Cannot find module '../FlairName'` and `'../FlairIcon'`.

- [ ] **Step 4: Create `client/src/components/user/FlairName.tsx`**

```tsx
import React from 'react';
import { getNameColorStyle } from '../../utils/flairUtils';

interface FlairNameProps {
  name: string;
  colorValue?: string | null;
  // Applied when no color is equipped (e.g. the shop preview's neutral text color).
  defaultColorClass?: string;
  // Small list text: omit the top-middle sparkle.
  compact?: boolean;
}

// The color class goes on a span holding only the name text. Gradient text is made
// transparent for background-clip, and that would blank anything nested inside it, so
// icons, the "(You)" tag and the sparkles are rendered outside this span.
const FlairName: React.FC<FlairNameProps> = ({
  name,
  colorValue,
  defaultColorClass = '',
  compact = false,
}) => {
  const colorClass = colorValue || defaultColorClass;
  const nameSpan = <span className={colorClass || undefined}>{name}</span>;
  const sparkleClass = colorValue ? getNameColorStyle(colorValue)?.sparkleClass : undefined;

  if (!sparkleClass) {
    return nameSpan;
  }

  return (
    <span className="flair-sparkle-wrap">
      {nameSpan}
      <span className={`flair-sparkle flair-sparkle-tr ${sparkleClass}`} aria-hidden="true">✦</span>
      <span className={`flair-sparkle flair-sparkle-bl ${sparkleClass}`} aria-hidden="true">✦</span>
      {!compact && (
        <span className={`flair-sparkle flair-sparkle-tm ${sparkleClass}`} aria-hidden="true">✦</span>
      )}
    </span>
  );
};

export default FlairName;
```

- [ ] **Step 5: Create `client/src/components/user/FlairIcon.tsx`**

```tsx
import React from 'react';
import { getIconClass } from '../../utils/flairUtils';

interface FlairIconProps {
  value: string;
  className?: string;
}

// The inner span is the animation/filter target so the wrapper's layout never moves.
const FlairIcon: React.FC<FlairIconProps> = ({ value, className = '' }) => {
  const classes = ['flair-icon', getIconClass(value), className].filter(Boolean).join(' ');

  return (
    <span className={classes} aria-hidden="true">
      <span className="flair-icon-glyph">{value}</span>
    </span>
  );
};

export default FlairIcon;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="components/user/__tests__/Flair(Name|Icon)"`
Expected: PASS (both files).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/user/FlairName.tsx client/src/components/user/FlairIcon.tsx client/src/components/user/__tests__/FlairName.test.tsx client/src/components/user/__tests__/FlairIcon.test.tsx
git commit -m "feat: FlairName and FlairIcon components" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Shared `TitleBadge` driven by the registry

**Files:**
- Rewrite: `client/src/components/user/TitleBadge.tsx`
- Test: `client/src/components/user/__tests__/TitleBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/user/__tests__/TitleBadge.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TitleBadge from '../TitleBadge';

describe('TitleBadge', () => {
  test('renders entry titles as the default pale-blue pill', () => {
    render(<TitleBadge value="Nakama" />);

    expect(screen.getByText('Nakama')).toHaveClass('bg-primary-100', 'text-primary-800');
  });

  test('renders unknown titles as the default pill', () => {
    render(<TitleBadge value="Dragon" />);

    expect(screen.getByText('Dragon')).toHaveClass('bg-primary-100');
  });

  test('renders mid titles with the shared silver class', () => {
    render(<TitleBadge value="Over 9000 Han" />);

    const badge = screen.getByText('Over 9000 Han');
    expect(badge).toHaveClass('flair-title-mid');
    expect(badge).not.toHaveClass('bg-primary-100');
  });

  test('renders Tsumo-nami with its own class and wave emoji', () => {
    render(<TitleBadge value="Tsumo-nami" />);

    const badge = screen.getByText('Tsumo-nami');
    expect(badge).toHaveClass('flair-title-tsumonami');
    expect(badge).toHaveTextContent('🌊');
  });

  test('renders existing premium titles with class and emoji', () => {
    const { unmount } = render(<TitleBadge value="Chicken Farmer" />);
    expect(screen.getByText('Chicken Farmer')).toHaveClass('flair-title-chicken');
    expect(screen.getByText('Chicken Farmer')).toHaveTextContent('🐔');
    unmount();

    render(<TitleBadge value="Chombo Chaser" />);
    expect(screen.getByText('Chombo Chaser')).toHaveClass('flair-title-chombo');
    expect(screen.getByText('Chombo Chaser')).toHaveTextContent('⚡');
  });
});
```

- [ ] **Step 2: Run the test to verify the new-title cases fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="components/user/__tests__/TitleBadge"`
Expected: FAIL on "renders Tsumo-nami with its own class and wave emoji" only. The current component gates premium styling on a hard-coded `PREMIUM_TITLES` set that does not contain Tsumo-nami, so it falls through to the default pill. The other cases already pass because Task 1's registry feeds `getMidTierTitleClass` and `getPremiumTitleClass`; that is fine, since this step's red test is the Tsumo-nami one.

- [ ] **Step 3: Rewrite `client/src/components/user/TitleBadge.tsx`**

```tsx
import React from 'react';
import { getTitleStyle } from '../../utils/flairUtils';

interface TitleBadgeProps {
  value: string;
}

const TitleBadge: React.FC<TitleBadgeProps> = ({ value }) => {
  const style = getTitleStyle(value);

  if (style && style.className) {
    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${style.className}`}>
        {style.emoji && <span className="mr-0.5">{style.emoji}</span>}
        {value}
      </span>
    );
  }

  return (
    <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
      {value}
    </span>
  );
};

export default TitleBadge;
```

- [ ] **Step 4: Run the tests to verify they pass, plus the existing consumers**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="(components/user/__tests__/TitleBadge|UserInfoSection|UserDisplay.flair)"`
Expected: PASS. (The existing profile-header and `UserDisplay` title tests still hold: `flair-title-mid`, `flair-title-chicken` classes are unchanged.)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/user/TitleBadge.tsx client/src/components/user/__tests__/TitleBadge.test.tsx
git commit -m "refactor: TitleBadge reads styles from the flair registry" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `UserAvatar` structure guard for premium borders

The ring-only spin is done in CSS (Task 4); `UserAvatar` needs no code change because its gradient wrapper already contains the avatar as a child. This task adds a test that locks that structure in, so nobody moves the avatar into the animated layer later.

**Files:**
- Test: `client/src/components/user/__tests__/UserAvatar.flair.test.tsx`

- [ ] **Step 1: Write the test**

Create `client/src/components/user/__tests__/UserAvatar.flair.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserAvatar from '../UserAvatar';

const userWithBorder = (profileBorder: string) => ({
  displayName: 'Alice',
  avatar: 'https://example.com/alice.png',
  equippedFlair: { nameColor: null, nameIcon: null, profileBorder, title: null },
});

describe('UserAvatar flair borders', () => {
  test.each(['flair-border-hanabi', 'flair-border-kitsune', 'flair-border-yozakura', 'flair-border-rainbow'])(
    'premium border %s wraps the avatar image in the ring element',
    borderClass => {
      render(<UserAvatar user={userWithBorder(borderClass)} />);

      const img = screen.getByRole('img', { name: "Alice's avatar" });
      expect(img).toHaveClass('flair-border-inner');
      expect(img.parentElement).toHaveClass(borderClass);
    }
  );

  test('mid border wraps the avatar image in a gradient wrapper', () => {
    render(<UserAvatar user={userWithBorder('flair-mid-torii')} />);

    const img = screen.getByRole('img', { name: "Alice's avatar" });
    expect(img).toHaveClass('flair-border-inner');
    expect(img.parentElement).toHaveClass('flair-mid-torii');
  });

  test('entry ring is applied directly to the image with no wrapper', () => {
    const { container } = render(<UserAvatar user={userWithBorder('flair-ring-manzu')} />);

    const img = screen.getByRole('img', { name: "Alice's avatar" });
    expect(img).toHaveClass('flair-ring-manzu');
    expect(container.firstChild).toBe(img);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="components/user/__tests__/UserAvatar.flair"`
Expected: PASS immediately. This is a characterization test of existing structure, so there is no red step. If it fails, `UserAvatar.tsx` has changed since this plan was written; stop and report.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/user/__tests__/UserAvatar.flair.test.tsx
git commit -m "test: lock in premium border wrapper structure" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `UserDisplay` uses `FlairName` and `FlairIcon`

**Files:**
- Modify: `client/src/components/user/UserDisplay.tsx`
- Test: `client/src/components/user/__tests__/UserDisplay.flair.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

In `client/src/components/user/__tests__/UserDisplay.flair.test.tsx`, add these tests inside the existing `describe('UserDisplay flair rendering', ...)` block, before its closing `});`:

```tsx
  test('renders the icon and the (You) tag outside the gradient name span', () => {
    const user = {
      _id: 'other-user',
      displayName: 'Alice',
      equippedFlair: { nameColor: 'flair-color-fuji', nameIcon: '🦊', profileBorder: null, title: null },
    };

    render(<UserDisplay user={user} showYouIndicator />);

    const name = screen.getByText('Alice');
    expect(name).toHaveClass('flair-color-fuji');
    expect(name).not.toContainElement(screen.getByText('🦊'));
    expect(name).not.toContainElement(screen.getByText('(You)'));
  });

  test('premium name colors render sparkles around the name', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: 'flair-color-neon', nameIcon: null, profileBorder: null, title: null },
    };

    const { container } = render(<UserDisplay user={user} />);

    expect(screen.getByText('Alice')).toHaveClass('flair-color-neon');
    expect(container.querySelectorAll('.flair-sparkle')).toHaveLength(3);
  });

  test('icons get their tier class', () => {
    const mid = render(
      <UserDisplay user={{ ...baseUser, equippedFlair: { nameColor: null, nameIcon: '🐉', profileBorder: null, title: null } }} />
    );
    expect(screen.getByText('🐉').parentElement).toHaveClass('flair-icon-glow');
    mid.unmount();

    render(
      <UserDisplay user={{ ...baseUser, equippedFlair: { nameColor: null, nameIcon: '🔥', profileBorder: null, title: null } }} />
    );
    expect(screen.getByText('🔥').parentElement).toHaveClass('flair-icon-flame');
  });

  test('renders a new premium title with its badge class', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: 'Tsumo-nami' },
    };

    render(<UserDisplay user={user} />);

    expect(screen.getByText('Tsumo-nami')).toHaveClass('flair-title-tsumonami');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="UserDisplay.flair"`
Expected: FAIL. The name, icon and "(You)" share one element today (`not.toContainElement` fails), no sparkles render, and the icon has no tier class.

- [ ] **Step 3: Edit `client/src/components/user/UserDisplay.tsx`**

Add these two imports after the existing `import TitleBadge from './TitleBadge';` line:

```tsx
import FlairName from './FlairName';
import FlairIcon from './FlairIcon';
```

Delete this line (around line 51):

```tsx
  const nameColorClass = flair?.nameColor || '';
```

Replace the `nameContent` block:

```tsx
  const nameContent = (
    <>
      {nameIcon && <span className="mr-1 text-sm" aria-hidden="true">{nameIcon}</span>}
      {displayName}
      {shouldShowYouIndicator && (
        <span className="ml-2 text-xs text-primary-600 font-normal">(You)</span>
      )}
    </>
  );
```

with:

```tsx
  const nameContent = (
    <>
      {nameIcon && <FlairIcon value={nameIcon} className="mr-1 text-sm" />}
      <FlairName name={displayName} colorValue={flair?.nameColor} />
      {shouldShowYouIndicator && (
        <span className="ml-2 text-xs text-primary-600 font-normal">(You)</span>
      )}
    </>
  );
```

In the `nameElement` block, remove `${nameColorClass} ` from both class strings. The `Link` becomes:

```tsx
    <Link
      to={`/profile/${user._id}`}
      className={`font-medium text-gray-900 hover:text-primary-600 hover:underline transition-colors ${nameClassName}`}
    >
```

and the `span` becomes:

```tsx
    <span className={`font-medium text-gray-900 ${nameClassName}`}>
```

(Behavior note: the flair color now sits on the inner name span, so a colored name keeps its flair color on link hover instead of turning `primary-600`. The underline still appears.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="UserDisplay"`
Expected: PASS for `UserDisplay.flair.test.tsx` (new and existing tests) and any other `UserDisplay` test files.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/user/UserDisplay.tsx client/src/components/user/__tests__/UserDisplay.flair.test.tsx
git commit -m "feat: UserDisplay renders names and icons through FlairName and FlairIcon" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Profile header (`UserInfoSection`) uses the same components

**Files:**
- Modify: `client/src/components/profile/UserInfoSection.tsx` (lines 105-110, plus imports)
- Test: `client/src/components/profile/UserInfoSection.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

In `client/src/components/profile/UserInfoSection.test.tsx`, add inside `describe('UserInfoSection flair rendering', ...)`, before its closing `});`:

```tsx
  test('premium name color renders sparkles and keeps the icon outside the gradient span', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: 'flair-color-neon', nameIcon: '🥷', profileBorder: null, title: null },
    };
    const { container } = render(
      <UserInfoSection
        user={user}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );

    const nameEl = screen.getByText('TestPlayer');
    expect(nameEl).toHaveClass('flair-color-neon');
    expect(nameEl).not.toContainElement(screen.getByText('🥷'));
    expect(container.querySelectorAll('.flair-sparkle')).toHaveLength(3);
    expect(screen.getByText('🥷').parentElement).toHaveClass('flair-icon-ninja');
  });
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="UserInfoSection"`
Expected: FAIL on the new test (the name `h3` still contains the icon and no sparkles render). The existing tests still pass.

- [ ] **Step 3: Edit `client/src/components/profile/UserInfoSection.tsx`**

Add these imports next to the existing `import TitleBadge from '../user/TitleBadge';` (line 9):

```tsx
import FlairName from '../user/FlairName';
import FlairIcon from '../user/FlairIcon';
```

Replace lines 105-110:

```tsx
              <h3 className={`text-3xl font-bold text-gray-900 ${user?.equippedFlair?.nameColor || ''}`}>
                {user?.equippedFlair?.nameIcon && (
                  <span className="mr-2 text-2xl" aria-hidden="true">{user.equippedFlair.nameIcon}</span>
                )}
                {user?.displayName}
              </h3>
```

with:

```tsx
              <h3 className="text-3xl font-bold text-gray-900">
                {user?.equippedFlair?.nameIcon && (
                  <FlairIcon value={user.equippedFlair.nameIcon} className="mr-2 text-2xl" />
                )}
                <FlairName name={user?.displayName ?? ''} colorValue={user?.equippedFlair?.nameColor} />
              </h3>
```

- [ ] **Step 3b: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="UserInfoSection"`
Expected: PASS, including the original `applies nameColor class to display name` test (the class now sits on the inner name span, which is what `getByText('TestPlayer')` returns).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/profile/UserInfoSection.tsx client/src/components/profile/UserInfoSection.test.tsx
git commit -m "feat: profile header renders flair through FlairName and FlairIcon" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `Shop.tsx`: shared components, private `TitleBadge` removed, equip fix

**Files:**
- Modify: `client/src/pages/Shop.tsx`
- Test: `client/src/pages/__tests__/Shop.test.tsx`

- [ ] **Step 1: Update the fixtures and add the failing tests**

In `client/src/pages/__tests__/Shop.test.tsx`:

1. Change line 2 to also import `waitFor`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

2. After line 30 (`const { useApi } = require('../../hooks/useApi');`) add:

```tsx
const { shopApi } = require('../../services/api');
```

3. In the test `shows Equipped badge for currently equipped item` (line 137), the fixture seeds the item's **id**, which is what hid the bug. Change:

```tsx
      equippedFlair: { nameColor: ownedItem._id, nameIcon: null, profileBorder: null, title: null },
```

to:

```tsx
      equippedFlair: { nameColor: ownedItem.value, nameIcon: null, profileBorder: null, title: null },
```

4. Immediately after that test (after its closing `});`), add:

```tsx
  test('clicking Equip on an owned item equips it by id', async () => {
    shopApi.equip.mockReset();
    shopApi.equip.mockResolvedValue({});
    const ownedItem = mockCatalog.nameColor[0];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: ownedItem, purchasedAt: '2026-01-01' }],
    });

    render(<Shop />);
    fireEvent.click(screen.getByRole('button', { name: /^equip$/i }));

    await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith('item1', 'nameColor'));
  });

  test('clicking Equipped unequips the item', async () => {
    shopApi.equip.mockReset();
    shopApi.equip.mockResolvedValue({});
    const ownedItem = mockCatalog.nameColor[0];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: ownedItem, purchasedAt: '2026-01-01' }],
      equippedFlair: { nameColor: ownedItem.value, nameIcon: null, profileBorder: null, title: null },
    });

    render(<Shop />);
    fireEvent.click(screen.getByRole('button', { name: /equipped/i }));

    await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith(null, 'nameColor'));
  });

  test('only the item whose value is equipped shows the Equipped badge', () => {
    const ownedA = mockCatalog.nameColor[0];
    const ownedB = mockCatalog.nameColor[1];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [
        { item: ownedA, purchasedAt: '2026-01-01' },
        { item: ownedB, purchasedAt: '2026-01-01' },
      ],
      equippedFlair: { nameColor: ownedA.value, nameIcon: null, profileBorder: null, title: null },
    });

    render(<Shop />);

    expect(screen.getAllByRole('button', { name: /equipped/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^equip$/i })).toHaveLength(1);
  });

  test('a premium name color previews with sparkles', () => {
    const catalog = {
      ...mockCatalog,
      nameColor: [
        { _id: 'gold1', name: 'Mahjong Gold', description: 'Gold', category: 'nameColor', cost: 300, value: 'flair-color-gold', tier: 'premium', sortOrder: 1, isActive: true } as ShopItem,
      ],
    };
    mockShopUseApi(catalog);

    render(<Shop />);

    const card = screen.getByTestId('flair-item-card-gold1');
    expect(card.querySelectorAll('.flair-sparkle')).toHaveLength(3);
  });

  test('a mid icon previews with the shared glow class', () => {
    mockShopUseApi();
    render(<Shop />);

    fireEvent.click(screen.getByRole('button', { name: /icons/i }));

    const card = screen.getByTestId('flair-item-card-item3');
    expect(card.querySelector('.flair-icon-glow')).toBeInTheDocument();
  });
```

(The `shows Equip button for owned unequipped items` test keeps working: its `getByRole('button', { name: /equip/i })` still matches exactly one button.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/Shop"`
Expected: FAIL. `shows Equipped badge…` and `clicking Equipped unequips…` fail because `Shop.tsx` still compares against `item._id`; the sparkle and glow tests fail because the cards do not use the new components.

- [ ] **Step 3: Edit `client/src/pages/Shop.tsx`**

**3a. Imports.** Replace line 13:

```tsx
import { isPremiumBorder, isMidTierBorder, getPremiumTitleClass, getPremiumTitleEmoji, getMidTierTitleClass } from '../utils/flairUtils';
```

with:

```tsx
import { isPremiumBorder, isMidTierBorder, isFlairEquipped } from '../utils/flairUtils';
import FlairName from '../components/user/FlairName';
import FlairIcon from '../components/user/FlairIcon';
import TitleBadge from '../components/user/TitleBadge';
```

**3b. Equip comparison in `handleEquip`.** Replace:

```tsx
    const isEquipped = equippedFlair[slot] === item._id;
```

with:

```tsx
    const isEquipped = isFlairEquipped(equippedFlair, item);
```

**3c. Preview name.** Replace:

```tsx
          <span className={`font-medium ${previewNameColor ?? 'text-gray-900'}`}>
            {previewIcon && <span className="mr-1 text-sm">{previewIcon}</span>}
            Your Name
          </span>
```

with:

```tsx
          <span className="font-medium">
            {previewIcon && <FlairIcon value={previewIcon} className="mr-1 text-sm" />}
            <FlairName name="Your Name" colorValue={previewNameColor} defaultColorClass="text-gray-900" />
          </span>
```

**3d. Preview title.** Replace:

```tsx
              <TitleBadge value={previewTitleItem.value} tier={previewTitleItem.tier} />
```

with:

```tsx
              <TitleBadge value={previewTitleItem.value} />
```

**3e. Card equipped comparison.** Replace:

```tsx
            const equipped = equippedFlair[item.category] === item._id;
```

with:

```tsx
            const equipped = isFlairEquipped(equippedFlair, item);
```

**3f. Card previews.** Replace:

```tsx
                  {item.category === 'nameColor' && (
                    <span className={`font-semibold text-base ${item.value}`}>Aa</span>
                  )}
                  {item.category === 'nameIcon' && (
                    <span className="text-2xl">{item.value}</span>
                  )}
```

with:

```tsx
                  {item.category === 'nameColor' && (
                    <span className="font-semibold text-base">
                      <FlairName name="Aa" colorValue={item.value} />
                    </span>
                  )}
                  {item.category === 'nameIcon' && (
                    <FlairIcon value={item.value} className="text-2xl" />
                  )}
```

and replace:

```tsx
                    <TitleBadge value={item.value} tier={item.tier} />
```

with:

```tsx
                    <TitleBadge value={item.value} />
```

**3g. Delete the private `TitleBadge`.** Remove the whole component at the bottom of the file, from `const TitleBadge: React.FC<{ value: string; tier: ShopItem['tier'] }> = ({ value, tier }) => {` through its closing `};`, and the blank line before it, so the file ends:

```tsx
};

export default Shop;
```

`ShopItem` is still used elsewhere in the file (hover state, handlers), so keep its import.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/Shop"`
Expected: PASS, including the original hover-preview tests (`Your Name` still carries `text-gray-900` before hover and `text-emerald-600` after, because `FlairName` puts the class on the same span).

- [ ] **Step 5: Type-check the client**

Run: `cd client && npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (Catches any leftover `tier` prop usage or unused import.)

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Shop.tsx client/src/pages/__tests__/Shop.test.tsx
git commit -m "fix: shop equipped state compares item value; use shared flair components" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Server test fixtures use values instead of ids

The server tests seed an item **id** into `equippedFlair`, which contradicts what `POST /api/shop/equip` actually stores (the item `value`). Correct them so they document real behavior.

**Files:**
- Modify: `server/src/routes/shop.test.js` (lines 154, 196, 203)
- Modify: `server/src/models/User.shopFlair.test.js` (the `can set equippedFlair.nameColor` test, around lines 85-91)

- [ ] **Step 1: Edit `server/src/routes/shop.test.js`**

Line 154, in `unequips a slot when itemId is null`, change:

```js
      'equippedFlair.nameColor': item._id.toString(),
```

to:

```js
      'equippedFlair.nameColor': item.value,
```

Line 196, in `returns purchasedItems and equippedFlair for the current user`, make the same change:

```js
      'equippedFlair.nameColor': item.value,
```

Line 203, same test, change:

```js
    expect(res.body.data.equippedFlair.nameColor).toBe(item._id.toString());
```

to:

```js
    expect(res.body.data.equippedFlair.nameColor).toBe(item.value);
```

- [ ] **Step 2: Edit `server/src/models/User.shopFlair.test.js`**

In `can set equippedFlair.nameColor`, change:

```js
      'equippedFlair.nameColor': item._id.toString(),
```

to:

```js
      'equippedFlair.nameColor': item.value,
```

and change:

```js
    expect(found.equippedFlair.nameColor).toBe(item._id.toString());
```

to:

```js
    expect(found.equippedFlair.nameColor).toBe(item.value);
```

- [ ] **Step 3: Run the server tests**

Run: `cd server && npx jest src/routes/shop.test.js src/models/User.shopFlair.test.js`
Expected: PASS (needs MongoDB; if unavailable, say so in your report and do not claim these passed).

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/shop.test.js server/src/models/User.shopFlair.test.js
git commit -m "test: equippedFlair fixtures store item values, matching the equip route" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Documentation

**Files:**
- Rewrite: `docs/flair-style-guide.md`
- Move + edit: `docs/tech-debt/flair/shop-equipped-state-compares-item-id-to-value.md` → `docs/completed-tech-debt/flair/`

- [ ] **Step 1: Rewrite `docs/flair-style-guide.md`**

```markdown
# Flair Style Guide

Visual design philosophy for the shop cosmetics system. Catalog data lives in `server/src/data/shopCatalog.js`; the client registry is in `client/src/utils/flairUtils.ts`; all styles are in `client/src/styles/flair.css`.

## Tier Hierarchy

The shop has three tiers. Each tier is visibly distinct in **every** category, so players can tell at a glance how rare an item is.

| Tier | Feel | Animation | Cost range |
|------|------|-----------|------------|
| Entry | Flat, clean, simple | None | 50–75 pts |
| Mid | Richer, textured, gradient or glow | None | 100–175 pts |
| Premium | Bold, animated, striking | Yes | 250–300 pts |

| Category | Entry | Mid | Premium |
|---|---|---|---|
| Name color | Flat color | Static two-hue gradient text | Flowing multi-hue gradient text + three ✦ sparkles on the text corners |
| Name icon | Plain emoji | Soft static golden glow | Emoji-specific motion + colored glow |
| Border | Flat `box-shadow` ring | Static gradient wrapper | Spinning conic-gradient ring |
| Title | Pale-blue pill (`bg-primary-100`) | Shared silver badge | Unique gradient badge with emoji and glow |

## Hard rules

- **Never rename an existing item's `value`.** The server copies `value` onto `User.equippedFlair` when a player equips it, so a rename orphans everyone who has it equipped. Restyle in CSS under the same class name.
- **Gradient text uses `background-image`, never the `background:` shorthand.** The shorthand resets `background-clip: text` and paints a solid box.
- **Never nest an icon, a "(You)" tag or sparkles inside a gradient-clipped span.** Clipped text is transparent and it is inherited. `FlairName` puts the color class on a span holding only the name; everything else is a sibling.
- **Mid-tier gradient end hues must be far enough apart to show on a ~10-character name.** Emerald → teal and blue → cyan read as flat; emerald → lime and navy → cyan → sea green do not.
- **Premium name colors must not resemble each other.** Crimson Dragon is red → slate so it is distinct from Mahjong Gold.
- **Premium icons use motion, not sparkles.** Premium names already sparkle; a player with both should not get duplicate effects.
- **Every animation needs a `prefers-reduced-motion` fallback** (bottom of `flair.css`). Premium items keep their static look.
- **Item names are unique across the whole catalog** (the seed matches on `name`), and `sortOrder` lists entry, then mid, then premium within each category.

## Profile Borders

### Entry (`flair-ring-*`)
A plain `box-shadow` ring applied directly to the avatar. Single solid color. No wrapper.

### Mid (`flair-mid-*`)
A **static** 5-stop linear gradient on a wrapper element, light to dark within one color family.

### Premium (`flair-border-*`)
A spinning conic gradient on a wrapper. **Only the `::before` layer rotates**; the avatar (`.flair-border-inner`) sits above it and stays still. Each class sets `--flair-conic`, `--flair-spin-duration` and optionally `--flair-spin-direction: reverse`.

### Adding a border
- Entry: add a `flair-ring-*` class with a `box-shadow`.
- Mid: add a `flair-mid-*` class and add it to the shared selector list at the top of the mid section.
- Premium: add a `flair-border-*` class, add it to the shared selector lists (base and `::before`, and the reduced-motion block), and set the three custom properties.
- Prefix detection (`isPremiumBorder`, `isMidTierBorder`) is automatic.

## Name Colors (`flair-color-*`)

- **Entry:** a plain `color:` declaration.
- **Mid:** a two-hue `linear-gradient(90deg, …)` with the shared text-clip mechanics. Static.
- **Premium:** a multi-hue gradient with `background-size: 300% 100%` and the `flair-flow` animation, plus three `aria-hidden` ✦ sparkles (`flair-sparkle-tr`, `-bl`, `-tm`) from `FlairName`, colored by a `flair-sparkles-*` palette class. `compact` drops the top-middle sparkle.

### Adding a name color
1. Add the class in `flair.css` (and add mid/premium classes to the shared text-clip selector list; premium also to the flow and reduced-motion lists).
2. Add the value to `NAME_COLOR_STYLES` in `flairUtils.ts` (premium entries need a `sparkleClass`; add its `flair-sparkles-*` class to `flair.css`).
3. Add the item to `shopCatalog.js`. `flairCatalog.test.ts` fails if any of these three is missing.

## Name Icons

Rendered by `FlairIcon`: `<span class="flair-icon …tier class" aria-hidden><span class="flair-icon-glyph">🔥</span></span>`. Filters and keyframes target `.flair-icon-glyph`.

- **Entry:** no class.
- **Mid:** `flair-icon-glow`, a soft static golden `drop-shadow`. Shared by every mid icon.
- **Premium:** one class per emoji (`flair-icon-flame`, `-blossom`, `-firework`, `-wave`, `-ninja`) with its own keyframes and glow.

Icon keys in `ICON_STYLES` must match the stored string exactly. The torii gate is `'\u26E9\uFE0F'` (with its variation selector).

## Title Badges

Rendered by the shared `TitleBadge`, driven by `TITLE_STYLES`.

- **Entry:** pale-blue pill (`bg-primary-100 text-primary-800`). No registry class.
- **Mid:** all share `flair-title-mid`, a silver/steel gradient. Intentionally neutral.
- **Premium:** each gets its own `flair-title-<slug>` class, an emoji prefix and a glow.

| Title | Class | Character |
|-------|-------|-----------|
| Chicken Farmer | `flair-title-chicken` | Warm gold, amber text, 🐔 |
| Chombo Chaser | `flair-title-chombo` | Red → purple gradient, white text, pink glow, ⚡ |
| Tsumo-nami | `flair-title-tsumonami` | Ocean gradient, white text, cyan glow, 🌊 |

## CSS Architecture

### Prefix conventions

| Prefix | Tier | Render approach |
|--------|------|----------------|
| `flair-ring-*` | Entry | `box-shadow` direct on avatar |
| `flair-mid-*` | Mid | Static gradient wrapper element |
| `flair-border-*` | Premium | Wrapper with a spinning `::before` ring |
| `flair-color-*` | Any | Color class on the name span (`FlairName`) |
| `flair-sparkle*` | Premium | Sparkle overlays and palettes (`FlairName`) |
| `flair-icon-*` | Mid/Premium | Class on the icon wrapper (`FlairIcon`) |
| `flair-title-*` | Mid/Premium | Class on the title badge (`TitleBadge`) |

Never embed flair class names directly in component logic; go through `flairUtils.ts`.
```

- [ ] **Step 2: Move the equip-bug plan to completed and mark it Complete**

The subagent left this file untracked, so use plain `mv` (not `git mv`):

```bash
mkdir -p docs/completed-tech-debt/flair
mv docs/tech-debt/flair/shop-equipped-state-compares-item-id-to-value.md docs/completed-tech-debt/flair/
rmdir docs/tech-debt/flair docs/tech-debt
sed -n '3,5p' docs/completed-tech-debt/flair/shop-equipped-state-compares-item-id-to-value.md
```

Expected output of the `sed`: `## State`, an empty line, then `New` (lines 3-5). Then:

```bash
sed -i '5s/^New$/Complete/' docs/completed-tech-debt/flair/shop-equipped-state-compares-item-id-to-value.md
sed -n '3,5p' docs/completed-tech-debt/flair/shop-equipped-state-compares-item-id-to-value.md
```

Expected: line 5 now reads `Complete`.

- [ ] **Step 3: Commit**

```bash
git add docs/flair-style-guide.md docs/completed-tech-debt/flair/shop-equipped-state-compares-item-id-to-value.md
git commit -m "docs: update flair style guide; complete equipped-state tech-debt plan" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Full verification and hand-off

**Files:** none modified unless a check fails.

- [ ] **Step 1: Run the full client suite**

Run: `cd client && npm test -- --watchAll=false`
Expected: all suites PASS. If a suite outside the files this plan touched fails, check whether it also fails on `main` (`git stash` is not needed; run `git diff main --stat` to see what you changed) before treating it as caused by this work, and report the result either way.

- [ ] **Step 2: Type-check and build the client**

Run: `cd client && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: no type errors; build succeeds. Treat new ESLint warnings in files this plan touched as failures and fix them.

- [ ] **Step 3: Run the server suite**

Run: `cd server && npx jest`
Expected: PASS. The Mongo-backed suites need a database; if none is available, run `npx jest src/data` and report exactly which suites you could not run.

- [ ] **Step 4: Verify in the browser (use the `run` skill)**

Start the app (`cd server && npm run dev`, `cd client && npm start`). Seeding the dev database is safe for a local database only; if `MONGODB_URI` points at anything shared or production, **stop and ask the user** before running `cd server && npm run seed:shop`. Then check, as a logged-in user with enough points (or by temporarily granting points in a local database):

1. **Shop tabs:** each of the four tabs lists entry, then mid, then premium items, 63 items in total, with the halved prices.
2. **Hover preview:** hovering each new item shows it in the preview box the way it looks elsewhere.
3. **Premium borders** (Hanabi, Kitsune Fire, Yozakura, plus Rainbow Halo and Dragon Scale): the ring spins, the avatar photo does **not** rotate.
4. **Premium names** (Neon Akihabara, Tanabata Stars, Crimson Dragon, Mahjong Gold): gradient flows, three ✦ sparkles overlap the name corners; Crimson Dragon (red/slate) is visibly different from Mahjong Gold.
5. **Mid names** (Jade Green, Ocean Blue, Royal Purple, Fuji Sunset, Moonlit Bamboo): the gradient is clearly visible on the name.
6. **Icon next to a gradient name, and the "(You)" tag:** both are visible, not blank. Check `UserDisplay` (e.g. a game list) and the profile header.
7. **Icons:** mid icons glow; Flame flickers, Cherry Blossom sways, Firework pulses, Great Wave rolls, Ninja blurs out and back.
8. **Equip flow:** buying and equipping shows "Equipped ✓"; clicking it unequips.
9. **Reduced motion:** enable "reduce motion" in the OS; everything above stops moving but stays visually distinct.

Report what you saw for each item, and be explicit about anything you could not check.

- [ ] **Step 5: Push nothing; hand off**

Do **not** merge, push, or seed a shared/production database. Report to the user:

- Everything above with results.
- **Rollout order:** deploy the client first, then run `cd server && npm run seed:shop` (seeding first would let players buy items whose CSS is not deployed).
- **Database check the user should run:** look for `equippedFlair` slots that still hold a 24-character ObjectId string instead of a flair value (the tech-debt plan's open hypothesis).
- Then use the `superpowers:finishing-a-development-branch` skill for merge/PR options.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| 33 new items with values, costs, descriptions | 2 |
| Halved prices on all 63 | 2 (values) and 3 (applied by seed) |
| Name color tiers + restyle existing mid/premium | 4 (CSS), 1 (registry) |
| Name icon tiers + restyle existing | 4, 1 |
| Premium ring-only spin, five borders | 4, 7 |
| Style registry, wrappers kept | 1 |
| `FlairName` (sparkles, `compact`), `FlairIcon` | 5 |
| Shared `TitleBadge`, `Shop.tsx` private copy deleted | 6, 10 |
| `UserDisplay`, Shop preview and cards use components | 8, 10 |
| Profile header (not in spec; same bug) | 9 |
| Shared catalog module; stale route list deleted | 2, 3 |
| Equipped-state fix and fixture corrections | 10, 11 |
| `prefers-reduced-motion` | 4 |
| Catalog integrity + cross-package test | 2, 4 |
| Style guide update; tech-debt plan completed | 12 |
| Rollout order, DB hypothesis check, browser verification | 13 |
