const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const Game = require('../models/Game');
const { RANKED_GAMES_THRESHOLD } = require('./rankedLeagueConstants');

const DUPLICATE_KEY_ERROR = 11000;

async function removeLedgerRow(transaction) {
  try {
    await PointTransaction.deleteOne({ _id: transaction._id });
  } catch (cleanupError) {
    console.error(
      `Point ledger drift: transaction ${transaction._id} has no matching balance update`,
      cleanupError
    );
  }
}

// The ledger row is written first; if the balance update then fails the row is removed again,
// so an error leaves the ledger and pointsBalance in agreement.
async function recordAward({ userId, type, amount, metadata = {} }) {
  const transaction = await PointTransaction.create({ user: userId, type, amount, metadata });
  try {
    await User.updateOne(
      { _id: userId },
      { $inc: { pointsBalance: amount, totalPointsEarned: amount } }
    );
  } catch (error) {
    await removeLedgerRow(transaction);
    throw error;
  }
}

// Relies on the unique partial indexes on PointTransaction (per game / per tournament / per league):
// a duplicate-key error means this award was already made, so it is skipped.
async function recordAwardOnce(award) {
  try {
    await recordAward(award);
  } catch (error) {
    if (error.code !== DUPLICATE_KEY_ERROR) {
      throw error;
    }
  }
}

// One query resolves the guests for the whole batch rather than one lookup per award.
async function excludeGuestAwards(awards) {
  const guests = await User.find({ _id: { $in: awards.map(award => award.userId) }, isGuest: true })
    .select('_id');
  const guestIds = new Set(guests.map(guest => guest._id.toString()));
  return awards.filter(award => !guestIds.has(award.userId.toString()));
}

async function awardAll(awards) {
  const eligibleAwards = await excludeGuestAwards(awards);
  await Promise.all(eligibleAwards.map(recordAward));
}

async function awardAllOnce(awards) {
  const eligibleAwards = await excludeGuestAwards(awards);
  await Promise.all(eligibleAwards.map(recordAwardOnce));
}

async function awardPoints(userId, type, amount, metadata = {}) {
  await awardAll([{ userId, type, amount, metadata }]);
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

// Best-effort: read-then-write is not atomic, so concurrent verifications can overshoot the cap
// slightly. Returns the truncated award, or null when there is no headroom left to pay.
async function capGameAward(userId, type, amount, metadata) {
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

  return granted > 0 ? { userId, type, amount: granted, metadata } : null;
}

// Caps each award, then records the survivors at most once (unique per-game index) with one
// failing award never blocking the others. Guests are filtered out by the caller, which already
// resolved guest status for the whole game in one query. Returns the attempted count and any
// rejection reasons, so the caller can report "N of M" failures across several batches.
async function awardCappedBatch(awards) {
  const capped = (
    await Promise.all(awards.map(({ userId, type, amount, metadata }) => capGameAward(userId, type, amount, metadata)))
  ).filter(Boolean);

  const results = await Promise.allSettled(capped.map(recordAwardOnce));
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  return { attempted: capped.length, failures };
}

const REPEAT_GROUP_MAX_GAMES = 6;
const REPEAT_GROUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
// populated player would compare by object identity instead of id and silently defeat the guest
// and membership checks below. The only callers (routes/games.js, gamePointsReplay.js) award
// points before populating; keep it that way, or normalize with `player._id ?? player` first.
//
// Safe to call repeatedly for the same game: recordAwardOnce's unique per-game index makes each
// award land at most once, and one failing award never stops the others. Throws an AggregateError
// listing every failure once all awards were attempted.
async function awardGamePoints(game, verifierId) {
  const gameId = game._id;

  // One query resolves guest status for the whole game: it both identifies the repeat-group's
  // registered players and excludes guests from every award below.
  const playerIds = game.players.map(({ player }) => player);
  const players = await User.find({ _id: { $in: playerIds } }).select('isGuest').lean();
  const guestIds = new Set(players.filter(p => p.isGuest).map(p => p._id.toString()));
  const registeredIds = players.filter(p => !p.isGuest).map(p => p._id.toString());
  const groupKey = registeredIds.length < 2 ? null : [...registeredIds].sort().join(':');

  if (groupKey && (await hasReachedRepeatGroupLimit(groupKey, gameId))) {
    logCappedAward({ gameId, groupKey, reason: 'repeat_group' });
    return;
  }

  const metadata = { gameId, groupKey };
  const memberIds = new Set(playerIds.map(id => id.toString()));
  const isEligiblePlayer = id => memberIds.has(id.toString()) && !guestIds.has(id.toString());

  const placementAwards = game.players
    .filter(({ player }) => !guestIds.has(player.toString()))
    .map(({ player, rank }) => ({
      userId: player,
      type: GAME_PLACEMENT_TYPES[rank],
      amount: GAME_PLACEMENT_AMOUNTS[rank],
      metadata,
    }));

  const roleAwards = [];
  if (isEligiblePlayer(game.submittedBy)) {
    roleAwards.push({ userId: game.submittedBy, type: 'game_submitted', amount: GAME_SUBMITTED_AMOUNT, metadata });
  }
  if (verifierId && isEligiblePlayer(verifierId)) {
    roleAwards.push({ userId: verifierId, type: 'game_verified', amount: GAME_VERIFIED_AMOUNT, metadata });
  }

  // Two phases so a submitter/verifier who is also a placed player sees their own placement
  // award reflected in their daily-cap headroom before the role award is capped.
  const placementResult = await awardCappedBatch(placementAwards);
  const roleResult = await awardCappedBatch(roleAwards);

  const failures = [...placementResult.failures, ...roleResult.failures];
  const attempted = placementResult.attempted + roleResult.attempted;
  if (failures.length > 0) {
    throw new AggregateError(failures, `Failed to award ${failures.length} of ${attempted} points for game ${gameId}`);
  }

  await Game.updateOne({ _id: gameId }, { $set: { pointsAwardedAt: new Date() } });
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

  const droppedPlayerIds = new Set(
    tournament.players.filter(p => p.dropped).map(p => p.player.toString())
  );

  const participationAwards = tournament.players
    .filter(p => !p.dropped)
    .map(p => ({
      userId: p.player,
      type: 'tournament_participated',
      amount: TOURNAMENT_PARTICIPATION_AMOUNT,
      metadata: { tournamentId },
    }));

  const placementAwards = Array.isArray(tournament.top4)
    ? tournament.top4
      .slice(0, 4)
      .map((playerId, index) => ({
        userId: playerId,
        type: TOURNAMENT_PLACEMENT_TYPES[index],
        amount: TOURNAMENT_PLACEMENT_AMOUNTS[index],
        metadata: { tournamentId, placement: index + 1 },
      }))
      .filter(({ userId }) => !droppedPlayerIds.has(userId.toString()))
    : [];

  await awardAllOnce([...participationAwards, ...placementAwards]);
}

const RANKED_QUALIFICATION_AMOUNT = 10;

async function awardRankedQualificationPoints(userId, leagueId) {
  await awardAllOnce([
    {
      userId,
      type: 'ranked_league_qualified',
      amount: RANKED_QUALIFICATION_AMOUNT,
      metadata: { leagueId },
    },
  ]);
}

const RANKED_PLACEMENT_TYPES = [
  'ranked_league_placement_1',
  'ranked_league_placement_2',
  'ranked_league_placement_3',
];

const RANKED_PLACEMENT_AMOUNTS = [150, 100, 50];

// Standard competition ranking over qualified players: ties share a placement and the next placement is skipped (1, 1, 3).
function rankQualifiedPlayers(league) {
  const standings = [...league.players]
    .filter(p => p.gamesPlayed >= RANKED_GAMES_THRESHOLD)
    .sort((a, b) => b.rankedPoints - a.rankedPoints);

  return standings.map(standing => {
    const firstTied = standings.findIndex(other => other.rankedPoints === standing.rankedPoints);
    return { playerId: standing.player, placement: firstTied + 1 };
  });
}

async function awardRankedSeasonPlacementPoints(league) {
  const leagueId = league._id;

  const placementAwards = rankQualifiedPlayers(league)
    .filter(({ placement }) => placement <= RANKED_PLACEMENT_TYPES.length)
    .map(({ playerId, placement }) => ({
      userId: playerId,
      type: RANKED_PLACEMENT_TYPES[placement - 1],
      amount: RANKED_PLACEMENT_AMOUNTS[placement - 1],
      metadata: { leagueId, placement },
    }));
  await awardAllOnce(placementAwards);
}

module.exports = {
  awardPoints,
  getRecentEarnings,
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
  awardRankedSeasonPlacementPoints,
};
