// Mirrors server/src/utils/prestigeTitle.js; winnerTitle.test.ts keeps the two in step.
export const WINNER_TITLE_MAX_LENGTH = 30;

const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;

export function defaultWinnerTitle(name: string): string {
  let cut = name.trim().slice(0, WINNER_TITLE_MAX_LENGTH);
  const lastUnit = cut.charCodeAt(cut.length - 1);
  if (lastUnit >= HIGH_SURROGATE_MIN && lastUnit <= HIGH_SURROGATE_MAX) {
    cut = cut.slice(0, -1);
  }
  return cut.trimEnd();
}
