const { MS_PER_WEEK, getWeekStart, getWeekEnd } = require('./weekWindow');

describe('getWeekStart', () => {
  test('a Monday maps to itself at midnight UTC', () => {
    const monday = new Date('2026-01-05T15:30:00Z'); // a Monday
    expect(getWeekStart(monday).toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  test('a midweek date maps back to that week\'s Monday', () => {
    const wednesday = new Date('2026-01-07T23:59:59Z');
    expect(getWeekStart(wednesday).toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  test('a Sunday maps back to the Monday that started its week', () => {
    const sunday = new Date('2026-01-11T00:00:01Z');
    expect(getWeekStart(sunday).toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });
});

describe('getWeekEnd', () => {
  test('is exactly 7 days after the week start', () => {
    const weekStart = new Date('2026-01-05T00:00:00.000Z');
    expect(getWeekEnd(weekStart).toISOString()).toBe('2026-01-12T00:00:00.000Z');
  });
});

test('MS_PER_WEEK is 7 days in milliseconds', () => {
  expect(MS_PER_WEEK).toBe(7 * 24 * 60 * 60 * 1000);
});
