const Tournament = require('./Tournament');

describe('Tournament schema', () => {
  test('has preliminaryRoundCount field', () => {
    expect(Tournament.schema.path('preliminaryRoundCount')).toBeDefined();
  });

  test('preliminaryRoundCount defaults to null', () => {
    const path = Tournament.schema.path('preliminaryRoundCount');
    expect(path.defaultValue).toBe(null);
  });
});

describe('Tournament winnerTitle', () => {
  const { WINNER_TITLE_MAX_LENGTH } = require('../utils/prestigeTitle');

  test('is optional and capped at the shared limit', () => {
    const path = Tournament.schema.path('winnerTitle');
    expect(path).toBeDefined();
    expect(path.options.maxlength[0]).toBe(WINNER_TITLE_MAX_LENGTH);
  });

  test('accepts exactly the limit', () => {
    const tournament = new Tournament({ name: 'x', date: new Date(), winnerTitle: 'a'.repeat(WINNER_TITLE_MAX_LENGTH) });
    const error = tournament.validateSync();
    expect(error?.errors.winnerTitle).toBeUndefined();
  });

  test('rejects a title over the limit', () => {
    const tournament = new Tournament({ name: 'x', date: new Date(), winnerTitle: 'a'.repeat(WINNER_TITLE_MAX_LENGTH + 1) });
    const error = tournament.validateSync();
    expect(error?.errors.winnerTitle).toBeDefined();
  });
});
