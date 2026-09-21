// Replays point awards (and the ranked-league update) for verified games whose awards may be incomplete,
// e.g. after a database error while a game was being verified. Safe to run repeatedly: anything already
// paid or applied is skipped.
//
//   node scripts/replayGamePoints.js --game=<gameId>           replay one verified game
//   node scripts/replayGamePoints.js --since=2026-09-01        replay every verified game since that date
//                                                              that has no pointsAwardedAt marker
//   add --dry-run to list the games without awarding anything
//
// --since is required for the sweep so games verified under an older points scheme are never replayed.

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { replayGamePoints } = require('../src/utils/gamePointsReplay');

function readOption(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function parseOptions() {
  const gameId = readOption('game');
  const sinceText = readOption('since');
  const since = sinceText ? new Date(sinceText) : undefined;

  if (!gameId && !since) {
    throw new Error('Pass --game=<gameId> or --since=<date>');
  }
  if (since && Number.isNaN(since.getTime())) {
    throw new Error(`--since is not a valid date: ${sinceText}`);
  }
  if (gameId && !mongoose.isValidObjectId(gameId)) {
    throw new Error(`--game is not a valid game id: ${gameId}`);
  }

  return { gameId, since, dryRun: process.argv.includes('--dry-run') };
}

async function run() {
  const options = parseOptions();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB (${options.dryRun ? 'dry run' : 'APPLY'})`);

  const summary = await replayGamePoints(options);

  for (const id of summary.replayed) {
    console.log(`${options.dryRun ? 'Would replay' : 'Replayed'} game ${id}`);
  }
  for (const { gameId, error } of summary.failed) {
    console.error(`FAILED game ${gameId}:`, error);
  }
  console.log(
    `Examined ${summary.examined} game(s): ${summary.replayed.length} ${options.dryRun ? 'to replay' : 'replayed'}, ${summary.failed.length} failed`
  );

  await mongoose.disconnect();
  if (summary.failed.length > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
