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
    .map(({ playerId, placement }) =>
      awardPointsOnce(
        playerId,
        RANKED_PLACEMENT_TYPES[placement - 1],
        RANKED_PLACEMENT_AMOUNTS[placement - 1],
        { leagueId, placement },
        'leagueId'
      )
    );
  await Promise.all(placementAwards);
}

module.exports = {
  awardPoints,
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
  awardRankedSeasonPlacementPoints,
};
