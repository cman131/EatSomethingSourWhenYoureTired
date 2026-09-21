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
