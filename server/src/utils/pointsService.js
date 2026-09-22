const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

async function awardPoints(userId, type, amount, metadata = {}) {
  const user = await User.findById(userId).select('isGuest');
  if (user && user.isGuest) {
    return;
  }

  await PointTransaction.create({ user: userId, type, amount, metadata });
  await User.findByIdAndUpdate(userId, {
    $inc: { pointsBalance: amount, totalPointsEarned: amount },
  });
}

// Awards at most once per (user, type, metadata[dedupeField]) so a repeated trigger cannot pay twice.
async function awardPointsOnce(userId, type, amount, metadata, dedupeField) {
  const alreadyAwarded = await PointTransaction.exists({
    user: userId,
    type,
    [`metadata.${dedupeField}`]: metadata[dedupeField],
  });
  if (alreadyAwarded) {
    return;
  }

  await awardPoints(userId, type, amount, metadata);
}

// Sums a user's positive earn transactions of the given types created at or after `since`.
async function getRecentEarnings(userId, types, since) {
  const rows = await PointTransaction.find({
    user: userId,
    type: { $in: types },
    amount: { $gt: 0 },
    createdAt: { $gte: since },
  })
    .select('amount')
    .lean();

  return rows.reduce((sum, row) => sum + row.amount, 0);
}

async function spendPoints(userId, amount, metadata = {}) {
  const user = await User.findById(userId).select('pointsBalance');
  if (!user || user.pointsBalance < amount) {
    throw new Error('Insufficient points balance');
  }
  await PointTransaction.create({ user: userId, type: 'shop_purchase', amount: -amount, metadata });
  await User.findByIdAndUpdate(userId, { $inc: { pointsBalance: -amount } });
}

const GAME_PLACEMENT_TYPES = {
  1: 'game_placement_1',
  2: 'game_placement_2',
  3: 'game_placement_3',
  4: 'game_placement_4',
};

const GAME_PLACEMENT_AMOUNTS = { 1: 10, 2: 7, 3: 4, 4: 2 };
const GAME_SUBMITTED_AMOUNT = 2;
const GAME_VERIFIED_AMOUNT = 1;
const GAME_POINT_TYPES = [...Object.values(GAME_PLACEMENT_TYPES), 'game_submitted', 'game_verified'];
const GAME_DAILY_CAP = 60;
const GAME_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

function logCappedAward(details) {
  console.warn('Points award capped', details);
}

// Best-effort: read-then-write is not atomic, so concurrent verifications can overshoot the cap slightly.
// Pays at most the headroom left under the daily cap; writes no row when there is none.
async function awardCappedPoints(userId, type, amount, metadata) {
  const since = new Date(Date.now() - GAME_DAILY_WINDOW_MS);
  const earned = await getRecentEarnings(userId, GAME_POINT_TYPES, since);
  const granted = Math.max(0, Math.min(amount, GAME_DAILY_CAP - earned));

  if (granted < amount) {
    logCappedAward({
      userId,
      gameId: metadata.gameId,
      type,
      requested: amount,
      granted,
      reason: 'daily_cap',
    });
  }
  if (granted === 0) {
    return;
  }

  await awardPoints(userId, type, granted, metadata);
}

const REPEAT_GROUP_MAX_GAMES = 6;
const REPEAT_GROUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Identifies a game's group by its registered (non-guest) players; null when fewer than 2.
async function findGameGroupKey(game) {
  const playerIds = game.players.map(({ player }) => player);
  const registered = await User.find({ _id: { $in: playerIds }, isGuest: { $ne: true } })
    .select('_id')
    .lean();

  if (registered.length < 2) {
    return null;
  }
  return registered
    .map(({ _id }) => _id.toString())
    .sort()
    .join(':');
}

// Counts games on the ledger, not the Game collection, because submitters can delete games.
async function hasReachedRepeatGroupLimit(groupKey, gameId) {
  const since = new Date(Date.now() - REPEAT_GROUP_WINDOW_MS);
  const gameIds = await PointTransaction.distinct('metadata.gameId', {
    type: { $in: GAME_POINT_TYPES },
    'metadata.groupKey': groupKey,
    createdAt: { $gte: since },
  });
  const otherGames = gameIds.filter(id => id && id.toString() !== gameId.toString());

  return otherGames.length >= REPEAT_GROUP_MAX_GAMES;
}

// Must run before `game.players.player` is populated to a User document: `.toString()` on a
// populated player would compare by object identity instead of id and silently defeat the
// submitter/verifier membership check below. The only caller (routes/games.js) awards points
// before populating; keep it that way, or normalize with `player._id ?? player` first.
async function awardGamePoints(game, verifierId) {
  const gameId = game._id;
  const groupKey = await findGameGroupKey(game);

  if (groupKey && (await hasReachedRepeatGroupLimit(groupKey, gameId))) {
    logCappedAward({ gameId, groupKey, reason: 'repeat_group' });
    return;
  }

  const metadata = { gameId, groupKey };
  const playerIds = new Set(game.players.map(({ player }) => player.toString()));

  const playerAwards = game.players.map(({ player, rank }) =>
    awardCappedPoints(player, GAME_PLACEMENT_TYPES[rank], GAME_PLACEMENT_AMOUNTS[rank], metadata)
  );
  await Promise.all(playerAwards);

  if (playerIds.has(game.submittedBy.toString())) {
    await awardCappedPoints(game.submittedBy, 'game_submitted', GAME_SUBMITTED_AMOUNT, metadata);
  }
  if (playerIds.has(verifierId.toString())) {
    await awardCappedPoints(verifierId, 'game_verified', GAME_VERIFIED_AMOUNT, metadata);
  }
}

const TOURNAMENT_PARTICIPATION_AMOUNT = 15;

const TOURNAMENT_PLACEMENT_TYPES = [
  'tournament_placement_1',
  'tournament_placement_2',
  'tournament_placement_3',
  'tournament_placement_4',
];

const TOURNAMENT_PLACEMENT_AMOUNTS = [200, 100, 70, 50];

async function awardTournamentPoints(tournament) {
  const tournamentId = tournament._id;
  const awardOnce = (playerId, type, amount, metadata) =>
    awardPointsOnce(playerId, type, amount, { tournamentId, ...metadata }, 'tournamentId');

  const droppedPlayerIds = new Set(
    tournament.players.filter(p => p.dropped).map(p => p.player.toString())
  );

  const participantAwards = tournament.players
    .filter(p => !p.dropped)
    .map(p => awardOnce(p.player, 'tournament_participated', TOURNAMENT_PARTICIPATION_AMOUNT));
  await Promise.all(participantAwards);

  if (Array.isArray(tournament.top4)) {
    const placementAwards = tournament.top4
      .slice(0, 4)
      .map((playerId, index) => ({ playerId, index }))
      .filter(({ playerId }) => !droppedPlayerIds.has(playerId.toString()))
      .map(({ playerId, index }) =>
        awardOnce(
          playerId,
          TOURNAMENT_PLACEMENT_TYPES[index],
          TOURNAMENT_PLACEMENT_AMOUNTS[index],
          { placement: index + 1 }
        )
      );
    await Promise.all(placementAwards);
  }
}

const RANKED_QUALIFICATION_AMOUNT = 10;

async function awardRankedQualificationPoints(userId, leagueId) {
  await awardPointsOnce(
    userId,
    'ranked_league_qualified',
    RANKED_QUALIFICATION_AMOUNT,
    { leagueId },
    'leagueId'
  );
}

module.exports = {
  awardPoints,
  getRecentEarnings,
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
};
