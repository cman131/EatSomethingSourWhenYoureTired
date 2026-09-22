import { WINNER_TITLE_MAX_LENGTH, defaultWinnerTitle } from '../winnerTitle';

// Reads the server helper directly so the two packages cannot drift apart.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const server = require('../../../../server/src/utils/prestigeTitle');

describe('defaultWinnerTitle', () => {
  test('trims a short name', () => {
    expect(defaultWinnerTitle('  Spring Open  ')).toBe('Spring Open');
  });

  test('cuts a long name to the limit', () => {
    expect(defaultWinnerTitle('a'.repeat(50))).toBe('a'.repeat(30));
  });

  test('drops trailing whitespace exposed by the cut', () => {
    expect(defaultWinnerTitle(`${'a'.repeat(29)} bbb`)).toBe('a'.repeat(29));
  });

  test('never splits a surrogate pair at the cut', () => {
    expect(defaultWinnerTitle(`${'a'.repeat(29)}😀`)).toBe('a'.repeat(29));
  });
});

describe('parity with the server helper', () => {
  test('uses the same limit', () => {
    expect(WINNER_TITLE_MAX_LENGTH).toBe(server.WINNER_TITLE_MAX_LENGTH);
  });

  test.each([
    'Spring Open',
    '  padded  ',
    'x'.repeat(45),
    `${'y'.repeat(29)} tail`,
    `${'z'.repeat(29)}😀`,
    '',
  ])('gives the same default for %j', name => {
    expect(defaultWinnerTitle(name)).toBe(server.defaultWinnerTitle(name));
  });
});
