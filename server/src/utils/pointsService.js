const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

async function awardPoints(userId, type, amount, metadata = {}) {
  await PointTransaction.create({ user: userId, type, amount, metadata });
  await User.findByIdAndUpdate(userId, {
    $inc: { pointsBalance: amount, totalPointsEarned: amount },
  });
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

const GAME_PLACEMENT_AMOUNTS = { 1: 8, 2: 5, 3: 3, 4: 1 };

async function awardGamePoints(game, verifierId) {
  const gameId = game._id;

  const playerAwards = game.players.map(({ player, rank }) =>
    awardPoints(player, GAME_PLACEMENT_TYPES[rank], GAME_PLACEMENT_AMOUNTS[rank], { gameId })
  );
  await Promise.all(playerAwards);

  await awardPoints(game.submittedBy, 'game_submitted', 2, { gameId });
  await awardPoints(verifierId, 'game_verified', 1, { gameId });
}

const TOURNAMENT_PLACEMENT_TYPES = [
  'tournament_placement_1',
  'tournament_placement_2',
  'tournament_placement_3',
  'tournament_placement_4',
];

async function awardTournamentPoints(tournament) {
  const tournamentId = tournament._id;

  const participantAwards = tournament.players
    .filter(p => !p.dropped)
    .map(p => awardPoints(p.player, 'tournament_participated', 15, { tournamentId }));
  await Promise.all(participantAwards);

  if (Array.isArray(tournament.top4)) {
    const placementAwards = tournament.top4.slice(0, 4).map((playerId, index) => {
      const type = TOURNAMENT_PLACEMENT_TYPES[index];
      const amounts = [40, 30, 20, 10];
      return awardPoints(playerId, type, amounts[index], { tournamentId, placement: index + 1 });
    });
    await Promise.all(placementAwards);
  }
}

module.exports = { awardPoints, spendPoints, awardGamePoints, awardTournamentPoints };
