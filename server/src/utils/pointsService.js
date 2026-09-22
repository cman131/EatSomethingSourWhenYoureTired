const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const Game = require('../models/Game');
const { RANKED_GAMES_THRESHOLD } = require('./rankedLeagueConstants');
const {
  GAME_PLACEMENT_AMOUNTS,
  GAME_SUBMITTED_AMOUNT,
  GAME_VERIFIED_AMOUNT,
  GAME_DAILY_CAP,
  GAME_DAILY_WINDOW_MS,
  REPEAT_GROUP_MAX_GAMES,
  REPEAT_GROUP_WINDOW_MS,
  TOURNAMENT_PARTICIPATION_AMOUNT,
  TOURNAMENT_PLACEMENT_AMOUNTS,
  RANKED_QUALIFICATION_AMOUNT,
  RANKED_PLACEMENT_AMOUNTS,
  QUIZ_COMPLETION_AMOUNT,
  QUIZ_WEEKLY_CAP_COUNT,
} = require('./pointsConfig');
const { recordAward, recordAwardOnce, removeLedgerRow } = require('./pointsLedger');
const { getWeekStart, getWeekEnd } = require('./weekWindow');

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

const AdjustmentFailure = {
  UserNotFound: 'user_not_found',
  InsufficientBalance: 'insufficient_balance',
};

// Adjustments intentionally skip totalPointsEarned: that counter reflects points earned through
// play, and an admin correction (in either direction) is not a play event.
async function applyAdjustmentBalance(userId, amount) {
  if (amount >= 0) {
    return User.findOneAndUpdate(
      { _id: userId },
      { $inc: { pointsBalance: amount } },
      { projection: { _id: 1 } }
    );
  }
  // Guarded so a negative adjustment cannot race a spend/award below zero.
  return User.findOneAndUpdate(
    { _id: userId, pointsBalance: { $gte: -amount } },
    { $inc: { pointsBalance: amount } },
    { projection: { _id: 1 } }
  );
}

async function adjustPoints({ userId, amount, adjustedBy, reason }) {
  const userExists = await User.exists({ _id: userId });
  if (!userExists) {
    return { adjusted: false, reason: AdjustmentFailure.UserNotFound };
  }

  const transaction = await PointTransaction.create({
    user: userId,
    type: 'admin_adjustment',
    amount,
    metadata: { adjustedBy, reason },
  });

  const updated = await applyAdjustmentBalance(userId, amount);
  if (!updated) {
    await removeLedgerRow(transaction);
    return { adjusted: false, reason: AdjustmentFailure.InsufficientBalance };
  }

  return { adjusted: true };
}

const GAME_PLACEMENT_TYPES = {
  1: 'game_placement_1',
  2: 'game_placement_2',
  3: 'game_placement_3',
  4: 'game_placement_4',
};

const GAME_POINT_TYPES = [...Object.values(GAME_PLACEMENT_TYPES), 'game_submitted', 'game_verified'];

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

// Records a negative counterpart for every game-scoped transaction on this game, preserving the
// original rows so a player's points history still shows what was paid and why it was taken back.
// Used when a verified game is deleted. Keyed on the source transaction rather than the game, since
// one user can have more than one transaction for the same game (e.g. placement + submitted).
// Idempotent per transaction via recordAwardOnce: a repeat call skips any row already reversed, and
// one failing reversal never blocks the others. A player who already spent the points can go
// negative here — same as everywhere else $inc touches pointsBalance, nothing enforces its schema
// min of 0 outside a validated .save().
async function reverseGamePoints(gameId) {
  const originals = await PointTransaction.find({
    'metadata.gameId': gameId,
    type: { $in: GAME_POINT_TYPES },
  }).lean();

  const results = await Promise.allSettled(
    originals.map(tx => recordAwardOnce({
      userId: tx.user,
      type: 'game_points_reversal',
      amount: -tx.amount,
      metadata: { reversedGameId: gameId, reversalOf: tx._id },
    }))
  );

  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(failures, `Failed to reverse ${failures.length} of ${originals.length} points for game ${gameId}`);
  }
}

// Undoes the effect of the transaction the same way recordAward applied it, then removes the row.
// Unlike reverseGamePoints this leaves no ledger trace, which is fine here: the game document
// persists and gamePointsReplay.js can freely re-award it once pointsAwardedAt is cleared.
async function removeAward(transaction) {
  await User.updateOne(
    { _id: transaction.user },
    { $inc: { pointsBalance: -transaction.amount, totalPointsEarned: -transaction.amount } }
  );
  try {
    await PointTransaction.deleteOne({ _id: transaction._id });
  } catch (cleanupError) {
    console.error(
      `Point ledger drift: transaction ${transaction._id} was reversed on the balance but the row could not be removed`,
      cleanupError
    );
  }
}

// Deletes the game-scoped transactions for a game and reverses their effect on each user's balance,
// so the game can be re-awarded from scratch after an admin corrects its scores. Clears
// pointsAwardedAt so the game reads as "not yet awarded" again.
async function undoGamePoints(gameId) {
  const originals = await PointTransaction.find({
    'metadata.gameId': gameId,
    type: { $in: GAME_POINT_TYPES },
  });

  await Promise.all(originals.map(removeAward));
  await Game.updateOne({ _id: gameId }, { $unset: { pointsAwardedAt: 1 } });
}

const TOURNAMENT_PLACEMENT_TYPES = [
  'tournament_placement_1',
  'tournament_placement_2',
  'tournament_placement_3',
  'tournament_placement_4',
];

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

async function hasQuizWeeklyCapRoom(userId, referenceDate = new Date()) {
  const weekStart = getWeekStart(referenceDate);
  const weekEnd = getWeekEnd(weekStart);
  const earnedThisWeek = await PointTransaction.countDocuments({
    user: userId,
    type: 'quiz_completed',
    createdAt: { $gte: weekStart, $lt: weekEnd },
  });
  return earnedThisWeek < QUIZ_WEEKLY_CAP_COUNT;
}

// Awards +QUIZ_COMPLETION_AMOUNT once per (user, quizId) via the ledger's unique index, unless the
// user has already hit the weekly quiz cap. GET /generate/random (decisionQuizzes.js, discardQuizzes.js)
// can produce unlimited quizzes on demand, so the cap is what keeps this path from being farmable.
async function awardQuizCompletionPoints(userId, quizId) {
  const eligibleAwards = await excludeGuestAwards([
    { userId, type: 'quiz_completed', amount: QUIZ_COMPLETION_AMOUNT, metadata: { quizId } },
  ]);
  if (eligibleAwards.length === 0) {
    return;
  }
  if (!(await hasQuizWeeklyCapRoom(userId))) {
    return;
  }
  await recordAwardOnce(eligibleAwards[0]);
}

module.exports = {
  awardPoints,
  getRecentEarnings,
  spendPoints,
  adjustPoints,
  AdjustmentFailure,
  awardGamePoints,
  reverseGamePoints,
  undoGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
  awardRankedSeasonPlacementPoints,
  awardQuizCompletionPoints,
  rankQualifiedPlayers,
};
