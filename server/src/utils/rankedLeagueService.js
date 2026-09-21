const RankedLeague = require('../models/RankedLeague');
const { awardRankedQualificationPoints } = require('./pointsService');

const SEASON_DURATION_DAYS = 90;
const RANKED_GAMES_THRESHOLD = 3;
const RANKED_STARTING_POINT = 30000;
const RANK_UMA_BONUS = { 1: 30, 2: 10, 3: -10, 4: -30 };

async function getCurrentLeague() {
  const latestLeague = await RankedLeague.findOne().sort({ startDate: -1 });

  if (!latestLeague) {
    return await RankedLeague.create({ startDate: new Date(), players: [] });
  }

  const daysSinceStart = (Date.now() - latestLeague.startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceStart >= SEASON_DURATION_DAYS) {
    return await RankedLeague.create({ startDate: new Date(), players: [] });
  }

  return latestLeague;
}

async function awardQualificationPoints(playerIds, leagueId) {
  for (const playerId of playerIds) {
    try {
      await awardRankedQualificationPoints(playerId, leagueId);
    } catch (err) {
      console.error('Failed to award ranked league qualification points:', err);
    }
  }
}

function findLeaguePlayer(league, playerId) {
  return league.players.find(p => p.player.toString() === playerId.toString());
}

function hasAppliedGame(league, game) {
  return Boolean(game._id) && league.appliedGames.some(id => id.toString() === game._id.toString());
}

// Qualification awards are once-per-league, so a replay of an applied game can safely re-offer them
// to every qualified player in it; this is what recovers an award that failed on the first attempt.
async function retryQualificationPoints(game, league) {
  const qualifiedPlayerIds = game.players
    .map(({ player }) => findLeaguePlayer(league, player))
    .filter(leaguePlayer => leaguePlayer && leaguePlayer.gamesPlayed >= RANKED_GAMES_THRESHOLD)
    .map(leaguePlayer => leaguePlayer.player);

  await awardQualificationPoints(qualifiedPlayerIds, league._id);
}

// Applying a game is idempotent when it has an _id: the id is saved on the league together with the
// points, so a repeated call (a retry or an admin replay) applies nothing the second time.
async function updateRankedPoints(game) {
  const league = await getCurrentLeague();

  if (hasAppliedGame(league, game)) {
    await retryQualificationPoints(game, league);
    return;
  }

  const newlyQualifiedPlayerIds = [];

  for (const gamePlayer of game.players) {
    const playerId = gamePlayer.player.toString ? gamePlayer.player.toString() : String(gamePlayer.player);
    const leaguePlayer = findLeaguePlayer(league, playerId);
    if (!leaguePlayer) continue;

    const umaBase = (Number(gamePlayer.score) - RANKED_STARTING_POINT) / 1000;
    const rankBonus = RANK_UMA_BONUS[gamePlayer.rank] ?? 0;
    const gamesPlayedBefore = leaguePlayer.gamesPlayed;
    leaguePlayer.rankedPoints += umaBase + rankBonus;
    leaguePlayer.gamesPlayed += 1;

    if (gamesPlayedBefore < RANKED_GAMES_THRESHOLD && leaguePlayer.gamesPlayed >= RANKED_GAMES_THRESHOLD) {
      newlyQualifiedPlayerIds.push(leaguePlayer.player);
    }
  }

  if (game._id) {
    league.appliedGames.push(game._id);
  }
  league.markModified('players');
  await league.save();

  await awardQualificationPoints(newlyQualifiedPlayerIds, league._id);
}

module.exports = { getCurrentLeague, updateRankedPoints, RANKED_GAMES_THRESHOLD };
