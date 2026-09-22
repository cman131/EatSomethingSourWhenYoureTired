const {
  SHOWCASE_MAX_ENTRIES,
  SHOWCASE_STAT_KEYS,
  validateShowcase,
} = require('./showcaseService');

const profile = {
  ownedFlair: [
    { category: 'title', value: 'Regular' },
    { category: 'profileBackdrop', value: 'flair-backdrop-shoji' },
  ],
  favoriteYaku: 'Riichi',
  favoriteTile: 'tile-id',
};

const ok = entries => validateShowcase(entries, profile);

describe('validateShowcase', () => {
  test('caps the showcase at three entries', () => {
    expect(SHOWCASE_MAX_ENTRIES).toBe(3);
  });

  test('accepts an empty showcase', () => {
    expect(ok([])).toEqual({ valid: true, entries: [] });
  });

  test('accepts an owned flair entry, favorites and a stat', () => {
    const entries = [
      { type: 'flair', category: 'title', value: 'Regular' },
      { type: 'favoriteYaku' },
      { type: 'stat', key: 'gamesWon' },
    ];

    expect(ok(entries)).toEqual({ valid: true, entries });
  });

  test('strips fields that do not belong to the entry type', () => {
    const result = ok([{ type: 'favoriteTile', value: 'x', key: 'y', extra: 1 }]);

    expect(result).toEqual({ valid: true, entries: [{ type: 'favoriteTile' }] });
  });

  test('rejects a non-array showcase', () => {
    expect(ok('nope').valid).toBe(false);
    expect(ok({ 0: { type: 'favoriteYaku' } }).valid).toBe(false);
  });

  test('rejects more than the maximum number of entries', () => {
    const result = ok([
      { type: 'favoriteYaku' },
      { type: 'favoriteTile' },
      { type: 'stat', key: 'gamesWon' },
      { type: 'stat', key: 'gamesPlayed' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/at most 3/i);
  });

  test('rejects a flair entry the user does not own', () => {
    const result = ok([{ type: 'flair', category: 'title', value: 'Tenpai' }]);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/do not own/i);
  });

  test('rejects an owned value pinned under the wrong category', () => {
    expect(ok([{ type: 'flair', category: 'nameIcon', value: 'Regular' }]).valid).toBe(false);
  });

  test('rejects a flair entry with a non-string value', () => {
    expect(ok([{ type: 'flair', category: 'title', value: { $ne: null } }]).valid).toBe(false);
  });

  test('rejects favorites the user has not set', () => {
    const bare = { ownedFlair: [], favoriteYaku: null, favoriteTile: null };

    expect(validateShowcase([{ type: 'favoriteYaku' }], bare).valid).toBe(false);
    expect(validateShowcase([{ type: 'favoriteTile' }], bare).valid).toBe(false);
  });

  test.each(SHOWCASE_STAT_KEYS)('accepts the %s stat', key => {
    expect(ok([{ type: 'stat', key }]).valid).toBe(true);
  });

  test('rejects an unknown stat key', () => {
    expect(ok([{ type: 'stat', key: 'tournamentsWon' }]).valid).toBe(false);
  });

  test('rejects an unknown entry type', () => {
    expect(ok([{ type: 'achievement' }]).valid).toBe(false);
    expect(ok([null]).valid).toBe(false);
  });

  test('rejects duplicate entries', () => {
    const result = ok([{ type: 'favoriteYaku' }, { type: 'favoriteYaku' }]);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/duplicate/i);
  });
});
