import fs from 'fs';
import path from 'path';
import {
  getTitleStyle,
  getIconStyle,
  getNameColorStyle,
  isPremiumBorder,
  isMidTierBorder,
  PRESTIGE_TITLE_MARKER,
} from '../flairUtils';

// Reads the server catalog directly so the two packages cannot drift apart.
// Needs the whole repo checked out (not just client/): this reads the server catalog directly.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SHOP_CATALOG } = require('../../../../server/src/data/shopCatalog');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PRESTIGE_TITLE_MARKER: SERVER_PRESTIGE_TITLE_MARKER } = require('../../../../server/src/utils/prestigeTitle');

interface CatalogItem {
  name: string;
  category: string;
  tier: string;
  value: string;
}

const css = fs.readFileSync(path.join(__dirname, '../../styles/flair.css'), 'utf8');

const cssDefines = (className: string): boolean =>
  new RegExp(`\\.${className}(?![\\w-])`).test(css);

// Comments removed so selector text is clean.
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

// Selector lists of every rule whose declaration block matches `declaration`. The regex matches
// innermost `selectors { declarations }` pairs, so rules nested in @media/@supports are found too.
const selectorListsWith = (source: string, declaration: RegExp): string[] =>
  Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter(match => declaration.test(match[2]))
    .map(match => match[1]);

const isListed = (selectorLists: string[], selector: string): boolean =>
  selectorLists.some(list => list.split(',').map(s => s.trim()).includes(selector));

const itemsIn = (category: string): CatalogItem[] =>
  SHOP_CATALOG.filter((item: CatalogItem) => item.category === category);

// test.each rows: [display name, item]. The tuple type keeps `item` typed under strict mode.
const toRows = (items: CatalogItem[]): Array<[string, CatalogItem]> =>
  items.map((item): [string, CatalogItem] => [item.name, item]);

const rowsIn = (category: string): Array<[string, CatalogItem]> => toRows(itemsIn(category));

const rowsInTiers = (category: string, tiers: string[]): Array<[string, CatalogItem]> =>
  toRows(itemsIn(category).filter(item => tiers.includes(item.tier)));

describe('shop catalog ↔ client registry ↔ flair.css', () => {
  test.each(rowsIn('title'))('title %s is registered and styled', (_name, item) => {
    const style = getTitleStyle(item.value);
    const needsClass = item.tier !== 'entry';
    const classStyled = !needsClass || cssDefines(style?.className ?? '');
    expect(style?.tier).toBe(item.tier);
    expect(Boolean(style?.className)).toBe(needsClass);
    expect(classStyled).toBe(true);
  });

  test.each(rowsIn('nameIcon'))('icon %s is registered and styled', (_name, item) => {
    const style = getIconStyle(item.value);
    const needsClass = item.tier !== 'entry';
    const classStyled = !needsClass || cssDefines(style?.className ?? '');
    expect(style?.tier).toBe(item.tier);
    expect(Boolean(style?.className)).toBe(needsClass);
    expect(classStyled).toBe(true);
  });

  test.each(rowsIn('nameColor'))('name color %s is registered and styled', (_name, item) => {
    const style = getNameColorStyle(item.value);
    const isPremium = item.tier === 'premium';
    const sparkleStyled = !isPremium || cssDefines(style?.sparkleClass ?? '');
    expect(style?.tier).toBe(item.tier);
    expect(cssDefines(item.value)).toBe(true);
    expect(style?.sparkleClass !== undefined).toBe(isPremium);
    expect(sparkleStyled).toBe(true);
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

describe('prestige titles', () => {
  test('use the same marker as the server', () => {
    expect(PRESTIGE_TITLE_MARKER).toBe(SERVER_PRESTIGE_TITLE_MARKER);
  });

  test('any value starting with the marker resolves to the prestige style', () => {
    const style = getTitleStyle(`${PRESTIGE_TITLE_MARKER}Spring Open`);

    expect(style?.tier).toBe('prestige');
    expect(cssDefines(style?.className ?? '')).toBe(true);
  });

  test('the marker only counts at the start of the value', () => {
    expect(getTitleStyle(`Spring ${PRESTIGE_TITLE_MARKER}Open`)).toBeNull();
  });

  test('no shop catalog title resolves to the prestige style', () => {
    for (const item of itemsIn('title')) {
      expect(getTitleStyle(item.value)?.tier).not.toBe('prestige');
    }
  });
});

describe('hand-synced selector lists in flair.css', () => {
  const gradientColors = rowsInTiers('nameColor', ['mid', 'premium']);
  const premiumColors = rowsInTiers('nameColor', ['premium']);
  const premiumBorders = rowsInTiers('profileBorder', ['premium']);
  const premiumIcons = rowsInTiers('nameIcon', ['premium']);

  const clipLists = selectorListsWith(cssNoComments, /background-clip:\s*text/);
  const transparentFillLists = selectorListsWith(cssNoComments, /-webkit-text-fill-color:\s*transparent/);
  const currentColorLists = selectorListsWith(cssNoComments, /-webkit-text-fill-color:\s*currentColor/);
  const conicLists = selectorListsWith(cssNoComments, /var\(--flair-conic\)/);
  const paddingLists = selectorListsWith(cssNoComments, /padding:\s*3px/);
  const flowLists = selectorListsWith(cssNoComments, /animation:\s*flair-flow/);

  const reducedMotionStart = cssNoComments.indexOf('@media (prefers-reduced-motion: reduce)');
  const reducedMotionNoneLists = selectorListsWith(
    cssNoComments.slice(reducedMotionStart),
    /animation:\s*none/,
  );

  test('the reduced-motion block exists', () => {
    expect(reducedMotionStart).toBeGreaterThanOrEqual(0);
  });

  test.each(gradientColors)('gradient name color %s is clipped to its text', (_name, item) => {
    expect(isListed(clipLists, `.${item.value}`)).toBe(true);
    expect(isListed(transparentFillLists, `.${item.value}`)).toBe(true);
  });

  test.each(gradientColors)('gradient name color %s has forced-colors and print fallbacks', (_name, item) => {
    const fallbackCount = currentColorLists.filter(list => isListed([list], `.${item.value}`)).length;
    expect(fallbackCount).toBeGreaterThanOrEqual(2);
  });

  test.each(premiumBorders)('premium border %s has a spinning ring layer and wrapper padding', (_name, item) => {
    expect(isListed(conicLists, `.${item.value}::before`)).toBe(true);
    expect(isListed(paddingLists, `.${item.value}`)).toBe(true);
  });

  test.each(premiumColors)('premium name color %s flows', (_name, item) => {
    expect(isListed(flowLists, `.${item.value}`)).toBe(true);
  });

  test.each(premiumBorders)('premium border %s stops spinning under reduced motion', (_name, item) => {
    expect(isListed(reducedMotionNoneLists, `.${item.value}::before`)).toBe(true);
  });

  test.each(premiumColors)('premium name color %s stops flowing under reduced motion', (_name, item) => {
    expect(isListed(reducedMotionNoneLists, `.${item.value}`)).toBe(true);
  });

  test.each(premiumIcons)('premium icon %s stops animating under reduced motion', (_name, item) => {
    const className = getIconStyle(item.value)?.className ?? '';
    expect(className).not.toBe('');
    expect(isListed(reducedMotionNoneLists, `.${className} .flair-icon-glyph`)).toBe(true);
  });

  test('sparkles stop twinkling under reduced motion', () => {
    expect(isListed(reducedMotionNoneLists, '.flair-sparkle')).toBe(true);
  });
});
