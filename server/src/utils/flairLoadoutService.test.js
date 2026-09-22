const { MAX_FLAIR_LOADOUTS, validateLoadoutSlots } = require('./flairLoadoutService');

const ownedItems = [
  { category: 'nameColor', value: 'flair-color-pink' },
  { category: 'nameIcon', value: '🏮' },
  { category: 'profileBackdrop', value: 'flair-backdrop-shoji' },
  { category: 'title', value: 'Regular' },
];

describe('MAX_FLAIR_LOADOUTS', () => {
  test('is fixed at 2', () => {
    expect(MAX_FLAIR_LOADOUTS).toBe(2);
  });
});

describe('validateLoadoutSlots', () => {
  test('accepts a loadout using only owned items', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Everyday',
      nameColor: 'flair-color-pink',
      nameIcon: '🏮',
      profileBorder: null,
      title: 'Regular',
    });

    expect(result).toEqual({ valid: true });
  });

  test('accepts a loadout using an owned profileBackdrop item', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Scenic',
      profileBackdrop: 'flair-backdrop-shoji',
    });

    expect(result).toEqual({ valid: true });
  });

  test('ignores empty slots', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Just a color',
      nameColor: 'flair-color-pink',
      nameIcon: null,
      profileBorder: null,
      title: null,
    });

    expect(result.valid).toBe(true);
  });

  test('treats missing slot keys the same as null', () => {
    const result = validateLoadoutSlots(ownedItems, { name: 'Sparse', nameColor: 'flair-color-pink' });

    expect(result.valid).toBe(true);
  });

  test('rejects a slot value the user does not own', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Fancy',
      nameColor: 'flair-color-gold',
    });

    expect(result.valid).toBe(false);
    expect(result.invalidSlots).toEqual([{ slot: 'nameColor', value: 'flair-color-gold' }]);
  });

  test('rejects an owned value equipped into the wrong slot category', () => {
    // 'flair-color-pink' is owned, but only as a nameColor item — not a title.
    const result = validateLoadoutSlots(ownedItems, { name: 'Odd', title: 'flair-color-pink' });

    expect(result.valid).toBe(false);
    expect(result.invalidSlots).toEqual([{ slot: 'title', value: 'flair-color-pink' }]);
  });

  test('reports every invalid slot at once', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Very Odd',
      nameColor: 'not-owned',
      title: 'also-not-owned',
    });

    expect(result.valid).toBe(false);
    expect(result.invalidSlots).toEqual([
      { slot: 'nameColor', value: 'not-owned' },
      { slot: 'title', value: 'also-not-owned' },
    ]);
  });

  test('allows a retired owned item (ownedItems has no isActive field to check)', () => {
    const retiredOwned = [{ category: 'nameColor', value: 'flair-color-old-retired' }];
    const result = validateLoadoutSlots(retiredOwned, { name: 'Retro', nameColor: 'flair-color-old-retired' });

    expect(result.valid).toBe(true);
  });

  test('a loadout with no slots set at all is valid (an empty look)', () => {
    const result = validateLoadoutSlots(ownedItems, { name: 'Blank' });

    expect(result.valid).toBe(true);
  });
});
