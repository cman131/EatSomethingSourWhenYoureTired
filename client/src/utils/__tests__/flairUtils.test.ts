import { isMidTierBorder, getMidTierTitleClass } from '../flairUtils';

describe('isMidTierBorder', () => {
  test('returns true for flair-mid- prefix', () => {
    expect(isMidTierBorder('flair-mid-jade')).toBe(true);
    expect(isMidTierBorder('flair-mid-cobalt')).toBe(true);
    expect(isMidTierBorder('flair-mid-sakura')).toBe(true);
  });

  test('returns false for other prefixes', () => {
    expect(isMidTierBorder('flair-ring-jade')).toBe(false);
    expect(isMidTierBorder('flair-border-rainbow')).toBe(false);
    expect(isMidTierBorder('')).toBe(false);
  });
});

describe('getMidTierTitleClass', () => {
  test('returns flair-title-mid for each mid-tier title', () => {
    expect(getMidTierTitleClass('East Wind')).toBe('flair-title-mid');
    expect(getMidTierTitleClass('Dragon Slayer')).toBe('flair-title-mid');
    expect(getMidTierTitleClass('Dora Hunter')).toBe('flair-title-mid');
  });

  test('returns empty string for non-mid-tier titles', () => {
    expect(getMidTierTitleClass('Chicken Farmer')).toBe('');
    expect(getMidTierTitleClass('Regular')).toBe('');
    expect(getMidTierTitleClass('')).toBe('');
  });
});
