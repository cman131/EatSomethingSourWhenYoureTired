const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const { prestigeTitleValue } = require('./prestigeTitle');

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

module.exports = {
  GRANT_KIND,
  grantEarnedTitle,
};
