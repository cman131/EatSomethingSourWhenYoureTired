const RankedLeague = require('../models/RankedLeague');

const SEASON_DURATION_DAYS = 90;

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

module.exports = { getCurrentLeague };
