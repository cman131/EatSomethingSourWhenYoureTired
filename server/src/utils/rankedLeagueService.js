const RankedLeague = require('../models/RankedLeague');
const { awardRankedQualificationPoints, awardRankedSeasonPlacementPoints } = require('./pointsService');
const { RANKED_GAMES_THRESHOLD } = require('./rankedLeagueConstants');
const { grantSeasonChampionTitles } = require('./flairGrantService');

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
    await grantSeasonChampionTitles(claimedLeague);
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

// Reverses the ranked delta and gamesPlayed applied for this game, leaving any ranked_league_qualified
// bonus already paid in place — qualification is not revoked by a later delete or edit. A game
// verified in an earlier season is looked up by which league's appliedGames contains it, not
// getCurrentLeague(), so the right season's standings are adjusted. Idempotent: removing gameId from
// appliedGames means a repeat call finds nothing to reverse.
async function reverseRankedPoints(game) {
  if (!game.isRanked || !game._id) {
    return;
  }

  const league = await RankedLeague.findOne({ appliedGames: game._id });
  if (!league) {
    return;
  }

  for (const gamePlayer of game.players) {
    const playerId = gamePlayer.player.toString ? gamePlayer.player.toString() : String(gamePlayer.player);
    const leaguePlayer = findLeaguePlayer(league, playerId);
    if (!leaguePlayer) continue;

    const umaBase = (Number(gamePlayer.score) - RANKED_STARTING_POINT) / 1000;
    const rankBonus = RANK_UMA_BONUS[gamePlayer.rank] ?? 0;
    leaguePlayer.rankedPoints -= umaBase + rankBonus;
    leaguePlayer.gamesPlayed = Math.max(0, leaguePlayer.gamesPlayed - 1);
  }

  league.appliedGames = league.appliedGames.filter(id => id.toString() !== game._id.toString());
  league.markModified('players');
  await league.save();
}

module.exports = { getCurrentLeague, updateRankedPoints, reverseRankedPoints, RANKED_GAMES_THRESHOLD };
