const { buildValidValueLookup, findInvalidSlots } = require('./equippedFlairAudit');

const items = [
  { category: 'nameColor', value: 'flair-color-pink' },
  { category: 'nameIcon', value: '🏮' },
  { category: 'profileBorder', value: 'flair-border-hanabi' },
  { category: 'title', value: 'flair-title-sensei' },
];

describe('findInvalidSlots', () => {
  const lookup = buildValidValueLookup(items);

  test('returns nothing when every equipped value matches an item of its slot', () => {
    const equipped = {
      nameColor: 'flair-color-pink',
      nameIcon: '🏮',
      profileBorder: 'flair-border-hanabi',
      title: 'flair-title-sensei',
    };

    expect(findInvalidSlots(equipped, lookup)).toEqual([]);
  });

  test('ignores empty slots', () => {
    expect(findInvalidSlots({ nameColor: null, title: undefined }, lookup)).toEqual([]);
  });

  test('flags a value that belongs to a different slot', () => {
    const equipped = { title: 'flair-color-pink' };

    expect(findInvalidSlots(equipped, lookup)).toEqual([
      { slot: 'title', value: 'flair-color-pink' },
    ]);
  });

  test('flags a value that matches no catalog item', () => {
    expect(findInvalidSlots({ nameIcon: 'made-up' }, lookup)).toEqual([
      { slot: 'nameIcon', value: 'made-up' },
    ]);
  });

  test('reports every invalid slot and keeps valid ones', () => {
    const equipped = {
      nameColor: 'flair-color-pink',
      nameIcon: 'flair-color-pink',
      title: 'nope',
    };

    expect(findInvalidSlots(equipped, lookup)).toEqual([
      { slot: 'nameIcon', value: 'flair-color-pink' },
      { slot: 'title', value: 'nope' },
    ]);
  });

  test('treats a missing equippedFlair as empty', () => {
    expect(findInvalidSlots(undefined, lookup)).toEqual([]);
  });
});
