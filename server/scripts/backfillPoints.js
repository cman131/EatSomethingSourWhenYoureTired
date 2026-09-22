// Replays point awards for verified games and completed tournaments whose awards may be incomplete
// (e.g. after a database error, or for events that predate this points feature), plus the tournament
// champion title. Safe to run repeatedly: anything already paid, granted, or applied is skipped.
//
//   node scripts/backfillPoints.js --game=<gameId>           replay one verified game
//   node scripts/backfillPoints.js --since=2026-09-01        replay every verified game since that
//                                                             date that has no pointsAwardedAt marker
//   node scripts/backfillPoints.js --tournament=<id>         replay one completed tournament
//   node scripts/backfillPoints.js                           replay every Completed tournament
//                                                             (games are skipped unless --game or
//                                                             --since is also passed)
//
//   add --dry-run to list what would be replayed without awarding anything
//
// Recommended: run with --dry-run first against production data before applying, to review what
// would be replayed.
//
// --game or --since is required to replay games at all: games verified under an older points scheme
// should never be swept up by accident. Tournaments have no such requirement — awardTournamentPoints
// and grantTournamentChampionTitle are idempotent, so sweeping every Completed tournament on every
// run is always safe.

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { replayGamePoints } = require('../src/utils/gamePointsReplay');
const { replayTournamentPoints } = require('../src/utils/tournamentPointsReplay');

function readOption(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function parseOptions() {
  const gameId = readOption('game');
  const sinceText = readOption('since');
  const since = sinceText ? new Date(sinceText) : undefined;
  const tournamentId = readOption('tournament');
  const dryRun = process.argv.includes('--dry-run');

  if (since && Number.isNaN(since.getTime())) {
    throw new Error(`--since is not a valid date: ${sinceText}`);
  }
  if (gameId && !mongoose.isValidObjectId(gameId)) {
    throw new Error(`--game is not a valid game id: ${gameId}`);
  }
  if (tournamentId && !mongoose.isValidObjectId(tournamentId)) {
    throw new Error(`--tournament is not a valid tournament id: ${tournamentId}`);
  }

  return { gameId, since, tournamentId, dryRun };
}

async function runGames({ gameId, since, dryRun }) {
  if (!gameId && !since) {
    console.log('Games: skipped (pass --game=<gameId> or --since=<date> to replay them)');
    return { examined: 0, replayed: [], failed: [] };
  }

  const summary = await replayGamePoints({ gameId, since, dryRun });
  for (const id of summary.replayed) {
    console.log(`Game: ${dryRun ? 'would replay' : 'replayed'} ${id}`);
  }
  for (const { gameId: failedId, error } of summary.failed) {
    console.error(`Game: FAILED ${failedId}:`, error);
  }
  console.log(
    `Games: examined ${summary.examined}, ${summary.replayed.length} ${dryRun ? 'to replay' : 'replayed'}, ${summary.failed.length} failed`
  );
  return summary;
}

async function runTournaments({ tournamentId, dryRun }) {
  const summary = await replayTournamentPoints({ tournamentId, dryRun });
  for (const id of summary.replayed) {
    console.log(`Tournament: ${dryRun ? 'would replay' : 'replayed'} ${id}`);
  }
  for (const { tournamentId: failedId, error } of summary.failed) {
    console.error(`Tournament: FAILED ${failedId}:`, error);
  }
  console.log(
    `Tournaments: examined ${summary.examined}, ${summary.replayed.length} ${dryRun ? 'to replay' : 'replayed'}, ${summary.failed.length} failed`
  );
  return summary;
}

async function run() {
  const options = parseOptions();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB (${options.dryRun ? 'dry run' : 'APPLY'})`);

  const gameSummary = await runGames(options);
  const tournamentSummary = await runTournaments(options);

  await mongoose.disconnect();

  if (gameSummary.failed.length > 0 || tournamentSummary.failed.length > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
