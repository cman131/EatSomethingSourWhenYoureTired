const RankedLeague = require('../models/RankedLeague');
const { awardRankedQualificationPoints, awardRankedSeasonPlacementPoints } = require('./pointsService');
const { RANKED_GAMES_THRESHOLD } = require('./rankedLeagueConstants');

const SEASON_DURATION_DAYS = 90;
const RANKED_STARTING_POINT = 30000;
const RANK_UMA_BONUS = { 1: 30, 2: 10, 3: -10, 4: -30 };
const REWARD_CLAIM_LEASE_MS = 5 * 60 * 1000;

async function resolveCurrentLeague() {
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

function claimSeasonRewards(leagueId) {
  const now = new Date();
  return RankedLeague.findOneAndUpdate(
    {
      _id: leagueId,
      rewardsAwardedAt: null,
      $or: [
        { rewardsClaimedAt: null },
        { rewardsClaimedAt: { $lt: new Date(now.getTime() - REWARD_CLAIM_LEASE_MS) } },
      ],
    },
    { $set: { rewardsClaimedAt: now } },
    { new: true }
  );
}

async function payEndedSeason(endedLeagueId) {
  const claimedLeague = await claimSeasonRewards(endedLeagueId);
  if (!claimedLeague) {
    return;
  }

  try {
    await awardRankedSeasonPlacementPoints(claimedLeague);
  } catch (err) {
    await RankedLeague.updateOne({ _id: endedLeagueId }, { $set: { rewardsClaimedAt: null } });
    throw err;
  }
  await RankedLeague.updateOne({ _id: endedLeagueId }, { $set: { rewardsAwardedAt: new Date() } });
}

// Every league older than the current one has ended. Paying all unpaid ones (rather than just the one whose expiry this
// request noticed) recovers from a crash after rollover and from a rollover race that created duplicate leagues.
async function awardEndedSeasonRewards(currentLeague) {
  const unpaidEndedLeagues = await RankedLeague.find({
    startDate: { $lt: currentLeague.startDate },
    rewardsAwardedAt: null,
  }).select('_id').sort({ startDate: 1 });

  for (const { _id } of unpaidEndedLeagues) {
    try {
      await payEndedSeason(_id);
    } catch (err) {
      console.error('Failed to award ranked season placement points:', err);
    }
  }
}

async function getCurrentLeague() {
  const currentLeague = await resolveCurrentLeague();

  try {
    await awardEndedSeasonRewards(currentLeague);
  } catch (err) {
    console.error('Failed to look up ranked seasons awaiting placement points:', err);
  }

  return currentLeague;
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

async function updateRankedPoints(game) {
  const league = await getCurrentLeague();
  const newlyQualifiedPlayerIds = [];

  for (const gamePlayer of game.players) {
    const playerId = gamePlayer.player.toString ? gamePlayer.player.toString() : String(gamePlayer.player);
    const leaguePlayer = league.players.find(p => p.player.toString() === playerId);
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

  league.markModified('players');
  await league.save();

  await awardQualificationPoints(newlyQualifiedPlayerIds, league._id);
}

module.exports = { getCurrentLeague, updateRankedPoints, RANKED_GAMES_THRESHOLD };
