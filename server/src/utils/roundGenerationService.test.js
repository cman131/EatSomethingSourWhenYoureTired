const mongoose = require('mongoose');
const { generateRoundPairings } = require('./roundGenerationService');

jest.mock('../models/User', () => {
  const m = require('mongoose');
  const MockUser = jest.fn().mockImplementation(function () {
    this._id = new m.Types.ObjectId();
    this.save = jest.fn().mockResolvedValue(this);
  });
  MockUser.findOne = jest.fn().mockResolvedValue(null);
  return MockUser;
});

function makePlayerIds(n) {
  return Array.from({ length: n }, () => new mongoose.Types.ObjectId().toString());
}

function makeRound1Pairings(playerIds) {
  const pairings = [];
  for (let i = 0; i < playerIds.length; i += 4) {
    pairings.push({
      tableNumber: i / 4 + 1,
      players: playerIds.slice(i, i + 4).map(id => ({ player: id }))
    });
  }
  return pairings;
}

function allPairedIds(pairings) {
  return pairings.flatMap(p => p.players.map(pl => pl.player.toString()));
}

describe('generateRoundPairings - wheel strategy with dropped players', () => {
  // Round 2 threshold = 12*(2-1)+4 = 16. 20 players > 16 → wheel triggers.
  const ROUND1_SIZE = 20;

  test('dropped player does not appear in round 2 pairings when wheel would be selected', async () => {
    const round1Players = makePlayerIds(ROUND1_SIZE);
    const droppedId = round1Players[0];
    const activePlayers = round1Players.slice(1); // 19 remaining

    const tournament = {
      roundStrategy: 'Scramble',
      players: [
        { player: droppedId, dropped: true },
        ...activePlayers.map(id => ({ player: id, dropped: false }))
      ],
      rounds: [
        { roundNumber: 1, pairings: makeRound1Pairings(round1Players) }
      ]
    };

    const pairings = await generateRoundPairings(tournament, 2);
    const ids = allPairedIds(pairings);

    expect(ids).not.toContain(droppedId);
  });

  test('returns the correct number of pairings after a player drops and filler is added', async () => {
    const round1Players = makePlayerIds(ROUND1_SIZE);
    const droppedId = round1Players[0];
    const activePlayers = round1Players.slice(1); // 19 → padded to 20 with 1 filler

    const tournament = {
      roundStrategy: 'Scramble',
      players: [
        { player: droppedId, dropped: true },
        ...activePlayers.map(id => ({ player: id, dropped: false }))
      ],
      rounds: [
        { roundNumber: 1, pairings: makeRound1Pairings(round1Players) }
      ]
    };

    const pairings = await generateRoundPairings(tournament, 2);

    // 19 real + 1 filler = 20 players → 5 tables
    expect(pairings).toHaveLength(5);
    expect(new Set(allPairedIds(pairings)).size).toBe(20);
  });

  test('wheel strategy is still used when no players have dropped', async () => {
    const round1Players = makePlayerIds(ROUND1_SIZE);

    const tournament = {
      roundStrategy: 'Scramble',
      players: round1Players.map(id => ({ player: id, dropped: false })),
      rounds: [
        { roundNumber: 1, pairings: makeRound1Pairings(round1Players) }
      ]
    };

    const pairings = await generateRoundPairings(tournament, 2);

    // All 20 original players appear, wheel produces valid full pairings
    expect(pairings).toHaveLength(5);
    const ids = allPairedIds(pairings);
    expect(new Set(ids).size).toBe(20);
    round1Players.forEach(id => expect(ids).toContain(id));
  });
});
