// Re-runs point awards for verified games whose awards may be incomplete (see scripts/replayGamePoints.js).
// Replaying is safe: awardGamePoints and updateRankedPoints both skip anything already applied.

const Game = require('../models/Game');
const { awardGamePoints } = require('./pointsService');
const { getCurrentLeague, updateRankedPoints } = require('./rankedLeagueService');

// A game verified moments ago may still be mid-award in its own request; leave it alone.
const DEFAULT_GRACE_MS = 5 * 60 * 1000;

async function findGamesToReplay({ gameId, since, graceMs }) {
  if (gameId) {
    return Game.find({ _id: gameId, verified: true });
  }

  return Game.find({
    verified: true,
    pointsAwardedAt: null,
    verifiedAt: { $gte: since, $lte: new Date(Date.now() - graceMs) },
  }).sort({ verifiedAt: 1 });
}

// A ranked game only counts toward the season it was verified in.
async function replayRankedPoints(game, league) {
  if (game.isRanked && game.verifiedAt >= league.startDate) {
    await updateRankedPoints(game);
  }
}

// Both halves are attempted even if the first fails, so one bad half never blocks the other.
async function replayGame(game, league) {
  const results = await Promise.allSettled([
    awardGamePoints(game, game.verifiedBy),
    replayRankedPoints(game, league),
  ]);

  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(failures, `Replay of game ${game._id} failed`);
  }
}

// Pass `gameId` to replay one game regardless of its marker, or `since` to replay every verified game
// without a marker from that date on. `since` is required so games verified under an older points scheme
// are never swept up by accident.
async function replayGamePoints({ gameId, since, graceMs = DEFAULT_GRACE_MS, dryRun = false }) {
  if (!gameId && !since) {
    throw new Error('replayGamePoints requires a gameId or since');
  }

  const games = await findGamesToReplay({ gameId, since, graceMs });
  const summary = { examined: games.length, replayed: [], failed: [] };
  if (games.length === 0) {
    return summary;
  }

  const league = await getCurrentLeague();
  for (const game of games) {
    const id = game._id.toString();
    if (dryRun) {
      summary.replayed.push(id);
      continue;
    }

    try {
      await replayGame(game, league);
      summary.replayed.push(id);
    } catch (err) {
      summary.failed.push({ gameId: id, error: err });
    }
  }

  return summary;
}

module.exports = { replayGamePoints, DEFAULT_GRACE_MS };
