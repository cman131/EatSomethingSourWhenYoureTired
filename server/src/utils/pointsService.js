const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const Game = require('../models/Game');

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
  const awards = game.players.map(({ player, rank }) => ({
    userId: player,
    type: GAME_PLACEMENT_TYPES[rank],
    amount: GAME_PLACEMENT_AMOUNTS[rank],
  }));
  awards.push({ userId: game.submittedBy, type: 'game_submitted', amount: GAME_SUBMITTED_AMOUNT });
  if (verifierId) {
    awards.push({ userId: verifierId, type: 'game_verified', amount: GAME_VERIFIED_AMOUNT });
  }
  return awards;
}

// Safe to call repeatedly for the same game: each award is paid at most once, and one failing award
// never stops the others. Throws an AggregateError listing every failure once all awards were attempted.
async function awardGamePoints(game, verifierId) {
  const gameId = game._id;
  const awards = buildGameAwards(game, verifierId);

  const results = await Promise.allSettled(
    awards.map(({ userId, type, amount }) => awardPointsOnce(userId, type, amount, { gameId }, 'gameId'))
  );

  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(failures, `Failed to award ${failures.length} of ${awards.length} points for game ${gameId}`);
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
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
};
