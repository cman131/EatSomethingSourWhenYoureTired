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
