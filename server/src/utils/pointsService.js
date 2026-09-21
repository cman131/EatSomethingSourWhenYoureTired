const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { RANKED_GAMES_THRESHOLD } = require('./rankedLeagueConstants');

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
