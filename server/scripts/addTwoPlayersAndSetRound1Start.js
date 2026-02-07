/**
 * Add 2 players to an active tournament, replace the first 2 filler players in round 1
 * pairings with those users, and set round 1 start date/time.
 *
 * Usage: node server/scripts/addTwoPlayersAndSetRound1Start.js <tournamentId> <userId1> <userId2> <dateString>
 * Or set env: TOURNAMENT_ID, USER_ID_1, USER_ID_2, START_DATE
 *
 * dateString: ISO 8601 or any format Node's Date() accepts (e.g. "2025-02-07T14:00:00.000Z").
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Tournament = require('../src/models/Tournament');
const User = require('../src/models/User');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mahjong-club';
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✓ MongoDB connected');
};

const SEAT_ORDER = ['East', 'South', 'West', 'North'];

const main = async () => {
  const tournamentId = process.env.TOURNAMENT_ID || process.argv[2];
  const userId1 = process.env.USER_ID_1 || process.argv[3];
  const userId2 = process.env.USER_ID_2 || process.argv[4];
  const dateString = process.env.START_DATE || process.argv[5];

  if (!tournamentId || !userId1 || !userId2 || !dateString) {
    console.error('Usage: node addTwoPlayersAndSetRound1Start.js <tournamentId> <userId1> <userId2> <dateString>');
    console.error('   Or set TOURNAMENT_ID, USER_ID_1, USER_ID_2, START_DATE');
    process.exit(1);
  }

  const startDate = new Date(dateString);
  if (Number.isNaN(startDate.getTime())) {
    console.error('Invalid date string:', dateString);
    process.exit(1);
  }

  await connectDB();

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    console.error('Tournament not found:', tournamentId);
    process.exit(1);
  }

  const round1 = tournament.rounds && tournament.rounds.find(r => r.roundNumber === 1);
  if (!round1 || !round1.pairings || round1.pairings.length === 0) {
    console.error('Tournament has no round 1 with pairings.');
    process.exit(1);
  }

  const user1 = await User.findById(userId1);
  const user2 = await User.findById(userId2);
  if (!user1) {
    console.error('User 1 not found:', userId1);
    process.exit(1);
  }
  if (!user2) {
    console.error('User 2 not found:', userId2);
    process.exit(1);
  }
  if (user1.isGuest || user2.isGuest) {
    console.error('Cannot add guest players to tournaments.');
    process.exit(1);
  }

  const existingPlayerIds = new Set(tournament.players.map(p => p.player.toString()));
  let addedCount = 0;
  if (!existingPlayerIds.has(user1._id.toString())) {
    tournament.players.push({ player: user1._id, uma: 0, dropped: false });
    addedCount++;
    tournament.markModified('players');
  }
  if (!existingPlayerIds.has(user2._id.toString())) {
    tournament.players.push({ player: user2._id, uma: 0, dropped: false });
    addedCount++;
    tournament.markModified('players');
  }

  const fillerUsers = await User.find({ isGuest: true, displayName: /^Filler \d+$/ });
  const fillerIds = new Set(fillerUsers.map(u => u._id.toString()));

  const pairingsSorted = [...round1.pairings].sort((a, b) => (a.tableNumber || 0) - (b.tableNumber || 0));
  const replacements = [{ userId: user1._id }, { userId: user2._id }];
  let replacementIndex = 0;

  for (const pairing of pairingsSorted) {
    if (!pairing.players || replacementIndex >= replacements.length) break;
    const bySeat = {};
    for (const entry of pairing.players) {
      bySeat[entry.seat] = entry;
    }
    for (const seat of SEAT_ORDER) {
      const entry = bySeat[seat];
      if (!entry) continue;
      const playerIdStr = entry.player.toString();
      if (fillerIds.has(playerIdStr)) {
        entry.player = replacements[replacementIndex].userId;
        replacementIndex++;
        if (replacementIndex >= replacements.length) break;
      }
    }
  }

  if (replacementIndex < 2) {
    console.error('Round 1 does not have at least two filler positions to replace. Found', replacementIndex, 'filler slot(s).');
    process.exit(1);
  }

  round1.startDate = startDate;
  tournament.markModified('rounds');
  await tournament.save();

  console.log('Done. Added', addedCount, 'player(s) to roster; replaced 2 filler slots in round 1 with', user1.displayName, 'and', user2.displayName, '; set round 1 start to', startDate.toISOString());
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
