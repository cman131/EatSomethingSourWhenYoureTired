const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const Game = require('../models/Game');
const { RANKED_GAMES_THRESHOLD } = require('./rankedLeagueConstants');
const {
  GAME_PLACEMENT_AMOUNTS,
  GAME_SUBMITTED_AMOUNT,
  GAME_VERIFIED_AMOUNT,
  TOURNAMENT_PARTICIPATION_AMOUNT,
  TOURNAMENT_PLACEMENT_AMOUNTS,
  RANKED_QUALIFICATION_AMOUNT,
  RANKED_PLACEMENT_AMOUNTS,
  QUIZ_COMPLETION_AMOUNT,
  QUIZ_WEEKLY_CAP_COUNT,
} = require('./pointsConfig');
const { recordAward, recordAwardOnce } = require('./pointsLedger');
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

function buildGameAwards(game, verifierId) {
  const metadata = { gameId: game._id };

  const awards = game.players.map(({ player, rank }) => ({
    userId: player,
    type: GAME_PLACEMENT_TYPES[rank],
    amount: GAME_PLACEMENT_AMOUNTS[rank],
    metadata,
  }));
  awards.push({ userId: game.submittedBy, type: 'game_submitted', amount: GAME_SUBMITTED_AMOUNT, metadata });
  if (verifierId) {
    awards.push({ userId: verifierId, type: 'game_verified', amount: GAME_VERIFIED_AMOUNT, metadata });
  }
  return awards;
}

// Safe to call repeatedly for the same game: the unique per-game index on PointTransaction makes each
// award land at most once, and one failing award never stops the others. Throws an AggregateError
// listing every failure once all awards were attempted.
async function awardGamePoints(game, verifierId) {
  const awards = buildGameAwards(game, verifierId);
  const eligibleAwards = await excludeGuestAwards(awards);

  const results = await Promise.allSettled(eligibleAwards.map(recordAwardOnce));

  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to award ${failures.length} of ${eligibleAwards.length} points for game ${game._id}`
    );
  }

  await Game.updateOne({ _id: game._id }, { $set: { pointsAwardedAt: new Date() } });
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
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
  awardRankedSeasonPlacementPoints,
  awardQuizCompletionPoints,
};
