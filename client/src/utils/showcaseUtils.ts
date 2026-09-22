import type { FlairCategory, ShowcaseEntry, ShowcaseStatKey } from '../services/api';

// Both mirror server/src/utils/showcaseService.js; showcaseUtils.test.ts fails if they drift.
export const SHOWCASE_MAX_ENTRIES = 3;

export const SHOWCASE_STAT_KEYS: ShowcaseStatKey[] = [
  'gamesWon',
  'gamesPlayed',
  'highestScore',
  'averageScore',
];

export const SHOWCASE_STAT_LABELS: Record<ShowcaseStatKey, string> = {
  gamesWon: 'Games Won',
  gamesPlayed: 'Games Played',
  highestScore: 'Highest Score',
  averageScore: 'Average Score',
};

export const FLAIR_CATEGORY_LABELS: Record<FlairCategory, string> = {
  nameColor: 'Name Effect',
  nameIcon: 'Icon',
  profileBorder: 'Border',
  profileBackdrop: 'Backdrop',
  title: 'Title',
};

// Two entries are the same pin when their key matches.
export function showcaseEntryKey(entry: ShowcaseEntry): string {
  switch (entry.type) {
    case 'flair':
      return `flair:${entry.category}:${entry.value}`;
    case 'stat':
      return `stat:${entry.key}`;
    default:
      return entry.type;
  }
}

// Pins the entry if it is not pinned and there is room, or unpins it if it is. Returns the
// original array when the showcase is full and the entry is not already in it.
export function toggleShowcaseEntry(entries: ShowcaseEntry[], entry: ShowcaseEntry): ShowcaseEntry[] {
  const key = showcaseEntryKey(entry);
  if (entries.some(existing => showcaseEntryKey(existing) === key)) {
    return entries.filter(existing => showcaseEntryKey(existing) !== key);
  }
  return entries.length >= SHOWCASE_MAX_ENTRIES ? entries : [...entries, entry];
}

export function formatStatValue(key: ShowcaseStatKey, value: number | undefined): string {
  if (value === undefined) {
    return '—';
  }
  const shown = key === 'averageScore' ? Math.round(value) : value;
  return shown.toLocaleString('en-US');
}
