const mongoose = require('mongoose');
const { generateRoundPairings } = require('./roundGenerationService');
const tournamentUma = require('../utils/tournamentUma');

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

beforeEach(() => {
  jest.clearAllMocks();
});

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

describe('generateRoundPairings - TieredPointsOnly strategy', () => {
  test('round 2 uses pre-populated game data without calling tournament.populate', async () => {
    const playerIds = makePlayerIds(8);

    const round1 = {
      roundNumber: 1,
      pairings: [
        {
          tableNumber: 1,
          players: playerIds.slice(0, 4).map(id => ({ player: id })),
          game: {
            verified: true,
            players: [
              { player: playerIds[0], score: 50000, rank: 1 },
              { player: playerIds[1], score: 30000, rank: 2 },
              { player: playerIds[2], score: 20000, rank: 3 },
              { player: playerIds[3], score: 20000, rank: 4 }
            ]
          }
        },
        {
          tableNumber: 2,
          players: playerIds.slice(4).map(id => ({ player: id })),
          game: {
            verified: true,
            players: [
              { player: playerIds[4], score: 45000, rank: 1 },
              { player: playerIds[5], score: 32000, rank: 2 },
              { player: playerIds[6], score: 18000, rank: 3 },
              { player: playerIds[7], score: 25000, rank: 4 }
            ]
          }
        }
      ]
    };

    const tournament = {
      roundStrategy: 'TieredPointsOnly',
      maxRounds: 4,
      players: playerIds.map(id => ({ player: id, dropped: false })),
      rounds: [round1]
      // No populate method — if the service calls it, this test will throw
    };

    const pairings = await generateRoundPairings(tournament, 2);

    expect(pairings).toHaveLength(2);
    const ids = allPairedIds(pairings);
    expect(new Set(ids).size).toBe(8);
    playerIds.forEach(id => expect(ids).toContain(id));
  });
});

describe('generateRoundPairings — TieredPointsOnly round 2, filler tier placement', () => {
  const realIds = ['real-p1', 'real-p2', 'real-p3', 'real-p4', 'real-p5'];

  function isFiller(playerId) {
    return !realIds.includes(playerId);
  }

  let umaMapSpy;

  beforeEach(() => {
    umaMapSpy = jest.spyOn(tournamentUma, 'computePlayerUmaMap');
  });

  afterEach(() => {
    umaMapSpy.mockRestore();
  });

  function buildTournament(completedPairings = []) {
    return {
      roundStrategy: 'TieredPointsOnly',
      startingPointValue: 30000,
      maxRounds: 0,
      umaPenalties: [],
      players: realIds.map(id => ({ player: id, dropped: false })),
      rounds: completedPairings.length > 0
        ? [{ roundNumber: 1, pairings: completedPairings }]
        : []
    };
  }

  test('fillers appear only in the bottom tier table, not in the top tier table', async () => {
    // 5 real players, UMA: p1=20 > p2=10 > p3=-1 > p4=-5 > p5=-10
    // Top 4 should be [p1, p2, p3, p4] — no fillers
    // Bottom table should be [p5, filler, filler, filler]
    umaMapSpy.mockReturnValue(new Map([
      ['real-p1', 20], ['real-p2', 10], ['real-p3', -1], ['real-p4', -5], ['real-p5', -10]
    ]));

    const round1Pairing = {
      tableNumber: 1,
      players: realIds.slice(0, 4).map(id => ({ player: id }))
    };
    const tournament = buildTournament([round1Pairing]);

    const pairings = await generateRoundPairings(tournament, 2);

    expect(pairings).toHaveLength(2);
    pairings.forEach(p => expect(p.players).toHaveLength(4));

    // There must be exactly one table that contains NO fillers
    const topTable = pairings.find(p => p.players.every(pp => !isFiller(pp.player)));
    expect(topTable).toBeDefined();

    // That table must contain the 4 highest-UMA real players
    const topIds = topTable.players.map(pp => pp.player);
    expect(topIds).toContain('real-p1');
    expect(topIds).toContain('real-p2');
    expect(topIds).toContain('real-p3');
    expect(topIds).toContain('real-p4');
    expect(topIds).not.toContain('real-p5');

    // The other table contains p5 and fillers
    const bottomTable = pairings.find(p => p !== topTable);
    const bottomIds = bottomTable.players.map(pp => pp.player);
    expect(bottomIds).toContain('real-p5');
    expect(bottomIds.filter(isFiller)).toHaveLength(3);
  });

  test('top tier table has no fillers even when filler UMA=0 ranks above negative-UMA real players', async () => {
    // Key invariant: fillers resolve to UMA=0 via ?? 0; here all real players p3–p5 have
    // negative UMA, so without the fix fillers would land in the top group (above negatives).
    umaMapSpy.mockReturnValue(new Map([
      ['real-p1', 15], ['real-p2', 8], ['real-p3', -2], ['real-p4', -7], ['real-p5', -12]
    ]));

    const round1Pairing = {
      tableNumber: 1,
      players: realIds.slice(0, 4).map(id => ({ player: id }))
    };
    const tournament = buildTournament([round1Pairing]);

    const pairings = await generateRoundPairings(tournament, 2);

    const topTable = pairings.find(p => p.players.every(pp => !isFiller(pp.player)));
    expect(topTable).toBeDefined();

    const topIds = topTable.players.map(pp => pp.player);
    // p3 and p4 have negative UMA but still belong in the top group over any filler
    expect(topIds).toContain('real-p3');
    expect(topIds).toContain('real-p4');
  });
});

describe('generateRoundPairings — TieredPointsOnly round 1 filler handling', () => {
  test('round 1 produces full tables when player count is not divisible by 4', async () => {
    const realIds = ['real-p1', 'real-p2', 'real-p3', 'real-p4', 'real-p5'];

    const tournament = {
      roundStrategy: 'TieredPointsOnly',
      startingPointValue: 30000,
      maxRounds: 0,
      umaPenalties: [],
      players: realIds.map(id => ({ player: id, dropped: false })),
      rounds: []
    };

    const pairings = await generateRoundPairings(tournament, 1);

    // 5 players → 3 fillers added → 2 full tables of 4
    expect(pairings).toHaveLength(2);
    pairings.forEach(p => expect(p.players).toHaveLength(4));

    const allIds = pairings.flatMap(p => p.players.map(pp => pp.player));
    expect(allIds).toHaveLength(8);

    const fillerCount = allIds.filter(id => !realIds.includes(id)).length;
    expect(fillerCount).toBe(3);
  });
});
