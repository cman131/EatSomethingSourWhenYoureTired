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

async function awardGamePoints(game, verifierId) {
  const gameId = game._id;

  const playerAwards = game.players.map(({ player, rank }) =>
    awardPoints(player, GAME_PLACEMENT_TYPES[rank], GAME_PLACEMENT_AMOUNTS[rank], { gameId })
  );
  await Promise.all(playerAwards);

  await awardPoints(game.submittedBy, 'game_submitted', GAME_SUBMITTED_AMOUNT, { gameId });
  await awardPoints(verifierId, 'game_verified', GAME_VERIFIED_AMOUNT, { gameId });
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
