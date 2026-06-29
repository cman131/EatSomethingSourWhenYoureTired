const RankedLeague = require('../models/RankedLeague');

const SEASON_DURATION_DAYS = 90;
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

async function updateRankedPoints(game) {
  const league = await getCurrentLeague();

  for (const gamePlayer of game.players) {
    const playerId = gamePlayer.player.toString ? gamePlayer.player.toString() : String(gamePlayer.player);
    const leaguePlayer = league.players.find(p => p.player.toString() === playerId);
    if (!leaguePlayer) continue;

    const umaBase = (Number(gamePlayer.score) - RANKED_STARTING_POINT) / 1000;
    const rankBonus = RANK_UMA_BONUS[gamePlayer.rank] ?? 0;
    leaguePlayer.rankedPoints += umaBase + rankBonus;
    leaguePlayer.gamesPlayed += 1;
  }

  league.markModified('players');
  await league.save();
}

module.exports = { getCurrentLeague, updateRankedPoints };
