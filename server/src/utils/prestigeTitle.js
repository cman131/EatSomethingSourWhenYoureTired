// Earned (prestige) titles are recognized by clients from this reserved prefix on the stored
// title value, so it must never change once shipped and no shop item value may start with it.
const PRESTIGE_TITLE_MARKER = '🏆 ';

const WINNER_TITLE_MAX_LENGTH = 30;

const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;

function defaultWinnerTitle(name) {
  let cut = String(name || '').trim().slice(0, WINNER_TITLE_MAX_LENGTH);
  const lastUnit = cut.charCodeAt(cut.length - 1);
  if (lastUnit >= HIGH_SURROGATE_MIN && lastUnit <= HIGH_SURROGATE_MAX) {
    cut = cut.slice(0, -1);
  }
  return cut.trimEnd();
}

function resolveWinnerTitle(tournament) {
  const custom = typeof tournament.winnerTitle === 'string' ? tournament.winnerTitle.trim() : '';
  return custom || defaultWinnerTitle(tournament.name);
}

// Validates a winnerTitle taken from a request body. Blank is allowed and means "use the default".
function normalizeWinnerTitle(raw) {
  if (raw === undefined || raw === null) {
    return { value: '' };
  }
  if (typeof raw !== 'string') {
    return { error: 'winnerTitle must be a string' };
  }
  const value = raw.trim();
  if (value.length > WINNER_TITLE_MAX_LENGTH) {
    return { error: `winnerTitle cannot be more than ${WINNER_TITLE_MAX_LENGTH} characters` };
  }
  return { value };
}

function prestigeTitleValue(label) {
  return `${PRESTIGE_TITLE_MARKER}${label}`;
}

module.exports = {
  PRESTIGE_TITLE_MARKER,
  WINNER_TITLE_MAX_LENGTH,
  defaultWinnerTitle,
  resolveWinnerTitle,
  normalizeWinnerTitle,
  prestigeTitleValue,
};
