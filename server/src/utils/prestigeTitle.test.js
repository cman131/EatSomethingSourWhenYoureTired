const {
  PRESTIGE_TITLE_MARKER,
  WINNER_TITLE_MAX_LENGTH,
  defaultWinnerTitle,
  resolveWinnerTitle,
  normalizeWinnerTitle,
  prestigeTitleValue,
} = require('./prestigeTitle');

describe('prestige title constants', () => {
  test('the marker and limit match what has shipped to clients', () => {
    expect(PRESTIGE_TITLE_MARKER).toBe('🏆 ');
    expect(WINNER_TITLE_MAX_LENGTH).toBe(30);
  });
});

describe('defaultWinnerTitle', () => {
  test('returns a short name trimmed', () => {
    expect(defaultWinnerTitle('  Spring Open  ')).toBe('Spring Open');
  });

  test('cuts a long name to the limit', () => {
    expect(defaultWinnerTitle('a'.repeat(50))).toBe('a'.repeat(30));
  });

  test('drops trailing whitespace exposed by the cut', () => {
    expect(defaultWinnerTitle(`${'a'.repeat(29)} bbb`)).toBe('a'.repeat(29));
  });

  test('never splits a surrogate pair at the cut', () => {
    const result = defaultWinnerTitle(`${'a'.repeat(29)}😀`);
    expect(result).toBe('a'.repeat(29));
    expect(result.length).toBeLessThanOrEqual(WINNER_TITLE_MAX_LENGTH);
  });

  test('returns an empty string for a missing name', () => {
    expect(defaultWinnerTitle(undefined)).toBe('');
  });
});

describe('resolveWinnerTitle', () => {
  test('uses the custom title, trimmed', () => {
    expect(resolveWinnerTitle({ name: 'Spring Open', winnerTitle: '  Spring Champ ' })).toBe('Spring Champ');
  });

  test('falls back to the truncated name when the title is blank', () => {
    expect(resolveWinnerTitle({ name: 'Spring Open', winnerTitle: '   ' })).toBe('Spring Open');
  });

  test('falls back to the truncated name when the title is missing', () => {
    expect(resolveWinnerTitle({ name: 'b'.repeat(40) })).toBe('b'.repeat(30));
  });
});

describe('normalizeWinnerTitle', () => {
  test('treats null and undefined as blank', () => {
    expect(normalizeWinnerTitle(undefined)).toEqual({ value: '' });
    expect(normalizeWinnerTitle(null)).toEqual({ value: '' });
  });

  test('trims the value', () => {
    expect(normalizeWinnerTitle('  Champ ')).toEqual({ value: 'Champ' });
  });

  test('accepts exactly the limit', () => {
    expect(normalizeWinnerTitle('a'.repeat(30))).toEqual({ value: 'a'.repeat(30) });
  });

  test('rejects a value over the limit', () => {
    expect(normalizeWinnerTitle('a'.repeat(31))).toEqual({
      error: 'winnerTitle cannot be more than 30 characters',
    });
  });

  test('rejects a non-string value', () => {
    expect(normalizeWinnerTitle(42)).toEqual({ error: 'winnerTitle must be a string' });
  });
});

describe('prestigeTitleValue', () => {
  test('prefixes the label with the marker', () => {
    expect(prestigeTitleValue('Spring Open')).toBe('🏆 Spring Open');
  });
});
