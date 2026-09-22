// Re-runs tournament point awards and the champion title grant for completed tournaments whose
// awards may be incomplete (see scripts/backfillPoints.js). Replaying is safe: awardTournamentPoints
// and grantTournamentChampionTitle both skip anything already applied.

const Tournament = require('../models/Tournament');
const { awardTournamentPoints } = require('./pointsService');
const { grantTournamentChampionTitle } = require('./flairGrantService');

async function findTournamentsToReplay(tournamentId) {
  if (tournamentId) {
    return Tournament.find({ _id: tournamentId, status: 'Completed' });
  }

  return Tournament.find({ status: 'Completed' });
}

// Both halves are attempted even if the first fails, so one bad half never blocks the other.
async function replayTournament(tournament) {
  const results = await Promise.allSettled([
    awardTournamentPoints(tournament),
    grantTournamentChampionTitle(tournament),
  ]);

  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(failures, `Replay of tournament ${tournament._id} failed`);
  }
}

// Pass `tournamentId` to replay one tournament, or omit it to sweep every Completed tournament.
// Unlike gamePointsReplay.js there is no marker to filter on and no since cutoff: both award
// functions are idempotent, so a full sweep is always safe to re-run.
async function replayTournamentPoints({ tournamentId, dryRun = false } = {}) {
  const tournaments = await findTournamentsToReplay(tournamentId);
  const summary = { examined: tournaments.length, replayed: [], failed: [] };

  for (const tournament of tournaments) {
    const id = tournament._id.toString();
    if (dryRun) {
      summary.replayed.push(id);
      continue;
    }

    try {
      await replayTournament(tournament);
      summary.replayed.push(id);
    } catch (err) {
      summary.failed.push({ tournamentId: id, error: err });
    }
  }

  return summary;
}

module.exports = { replayTournamentPoints };
