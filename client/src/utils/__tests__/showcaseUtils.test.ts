import fs from 'fs';
import path from 'path';
import type { ShowcaseEntry } from '../../services/api';
import {
  SHOWCASE_STAT_KEYS,
  formatStatValue,
  showcaseEntryKey,
  toggleShowcaseEntry,
} from '../showcaseUtils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const serverShowcase = require('../../../../server/src/utils/showcaseService');

const title: ShowcaseEntry = { type: 'flair', category: 'title', value: 'Regular' };
const icon: ShowcaseEntry = { type: 'flair', category: 'nameIcon', value: '🏮' };
const yaku: ShowcaseEntry = { type: 'favoriteYaku' };
const wins: ShowcaseEntry = { type: 'stat', key: 'gamesWon' };

describe('showcase constants stay in step with the server', () => {
  test('the stat keys match the server list', () => {
    expect([...SHOWCASE_STAT_KEYS].sort()).toEqual([...serverShowcase.SHOWCASE_STAT_KEYS].sort());
  });

  test('the client entry cap matches the server cap', () => {
    const source = fs.readFileSync(path.join(__dirname, '../showcaseUtils.ts'), 'utf8');
    const cap = /SHOWCASE_MAX_ENTRIES\s*=\s*(\d+)/.exec(source);

    expect(Number(cap?.[1])).toBe(serverShowcase.SHOWCASE_MAX_ENTRIES);
  });
});

describe('showcaseEntryKey', () => {
  test('is stable for equal entries and distinct for different ones', () => {
    expect(showcaseEntryKey({ ...title })).toBe(showcaseEntryKey(title));
    expect(showcaseEntryKey(title)).not.toBe(showcaseEntryKey(icon));
    expect(showcaseEntryKey(yaku)).not.toBe(showcaseEntryKey(wins));
    expect(showcaseEntryKey(wins)).not.toBe(showcaseEntryKey({ type: 'stat', key: 'gamesPlayed' }));
  });

  test('keeps a flair value under two categories apart', () => {
    const a: ShowcaseEntry = { type: 'flair', category: 'nameColor', value: 'x' };
    const b: ShowcaseEntry = { type: 'flair', category: 'profileBackdrop', value: 'x' };

    expect(showcaseEntryKey(a)).not.toBe(showcaseEntryKey(b));
  });
});

describe('toggleShowcaseEntry', () => {
  test('adds an entry that is not pinned', () => {
    expect(toggleShowcaseEntry([title], icon)).toEqual([title, icon]);
  });

  test('removes an entry that is already pinned', () => {
    expect(toggleShowcaseEntry([title, icon], title)).toEqual([icon]);
  });

  test('ignores an add once the cap is reached', () => {
    const full = [title, icon, yaku];

    expect(toggleShowcaseEntry(full, wins)).toBe(full);
  });

  test('still removes an entry when the showcase is full', () => {
    expect(toggleShowcaseEntry([title, icon, yaku], icon)).toEqual([title, yaku]);
  });

  test('does not mutate its input', () => {
    const entries = [title];
    toggleShowcaseEntry(entries, icon);

    expect(entries).toEqual([title]);
  });
});

describe('formatStatValue', () => {
  test('shows counts and scores as plain numbers', () => {
    expect(formatStatValue('gamesWon', 12)).toBe('12');
    expect(formatStatValue('highestScore', 48500)).toBe('48,500');
  });

  test('rounds the average score to a whole number', () => {
    expect(formatStatValue('averageScore', 25012.6)).toBe('25,013');
  });

  test('shows an em dash when the value is unavailable', () => {
    expect(formatStatValue('gamesWon', undefined)).toBe('—');
  });
});
