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
