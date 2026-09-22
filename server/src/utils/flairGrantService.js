const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const { prestigeTitleValue, resolveWinnerTitle } = require('./prestigeTitle');
const { rankQualifiedPlayers } = require('./pointsService');

const GRANT_KIND = {
  Tournament: 'tournament',
  RankedSeason: 'ranked_season',
};

const GRANT_DESCRIPTIONS = {
  [GRANT_KIND.Tournament]: 'Awarded for winning a tournament',
  [GRANT_KIND.RankedSeason]: 'Awarded for winning a ranked season',
};

const DUPLICATE_KEY_ERROR = 11000;

// One earned item per event. The unique sourceKey makes concurrent callers converge on one row: the
// loser of an upsert race gets a duplicate-key error and reads the winner's row instead.
async function upsertEarnedTitleItem(kind, refId, label) {
  const sourceKey = `${kind}:${refId}`;
  const value = prestigeTitleValue(label);
  try {
    return await ShopItem.findOneAndUpdate(
      { sourceKey },
      {
        $setOnInsert: {
          sourceKey,
          name: value,
          value,
          description: GRANT_DESCRIPTIONS[kind],
          category: 'title',
          tier: 'prestige',
          acquisition: 'earned',
          cost: 0,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === DUPLICATE_KEY_ERROR) {
      return ShopItem.findOne({ sourceKey });
    }
    throw err;
  }
}

// The conditional update makes a repeat grant a no-op. Guests have no account to equip from.
function addOwnership(userId, item, source) {
  return User.findOneAndUpdate(
    { _id: userId, isGuest: { $ne: true }, 'purchasedItems.item': { $ne: item._id } },
    { $push: { purchasedItems: { item: item._id, source } } },
    { projection: { _id: 1 } }
  );
}

async function grantEarnedTitle(userId, { kind, refId, label }) {
  const item = await upsertEarnedTitleItem(kind, refId, label);
  await addOwnership(userId, item, { kind, refId, label });
  return item;
}

// top4 holds user ids in production but may hold populated users; the points code treats both alike.
function idOf(entry) {
  return entry._id || entry;
}

async function grantTournamentChampionTitle(tournament) {
  const winner = Array.isArray(tournament.top4) ? tournament.top4[0] : undefined;
  if (!winner) {
    return;
  }

  const winnerId = idOf(winner);
  const entry = tournament.players.find(p => p.player.toString() === winnerId.toString());
  if (entry && entry.dropped) {
    return;
  }

  await grantEarnedTitle(winnerId, {
    kind: GRANT_KIND.Tournament,
    refId: tournament._id,
    label: resolveWinnerTitle(tournament),
  });
}

function seasonChampionLabel(league) {
  const month = league.startDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `Season Champion: ${month} ${league.startDate.getUTCFullYear()}`;
}

// Ties share placement 1, so every tied player is a champion.
async function grantSeasonChampionTitles(league) {
  const champions = rankQualifiedPlayers(league).filter(({ placement }) => placement === 1);
  const label = seasonChampionLabel(league);

  for (const { playerId } of champions) {
    await grantEarnedTitle(playerId, { kind: GRANT_KIND.RankedSeason, refId: league._id, label });
  }
}

module.exports = {
  GRANT_KIND,
  grantEarnedTitle,
  grantTournamentChampionTitle,
  grantSeasonChampionTitles,
};
