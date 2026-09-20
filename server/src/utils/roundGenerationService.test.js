jest.mock('../models/User', () => {
  const MockUser = jest.fn().mockImplementation(function(data) {
    this._id = { toString: () => `filler-for-${data.displayName.replace(/ /g, '-').toLowerCase()}` };
    this.save = jest.fn().mockResolvedValue(this);
  });
  MockUser.findOne = jest.fn().mockResolvedValue(null);
  return MockUser;
});

jest.mock('../utils/tournamentUma', () => ({
  computePlayerUmaMap: jest.fn()
}));

const { computePlayerUmaMap } = require('../utils/tournamentUma');
const { generateRoundPairings } = require('./roundGenerationService');

function buildTournament(playerIds, strategy, completedPairings = []) {
  return {
    roundStrategy: strategy,
    startingPointValue: 30000,
    maxRounds: 0,
    umaPenalties: [],
    players: playerIds.map(id => ({ player: id, dropped: false })),
    rounds: completedPairings.length > 0
      ? [{ roundNumber: 1, pairings: completedPairings }]
      : [],
    populate: jest.fn().mockResolvedValue(undefined)
  };
}

function isFiller(playerId) {
  return playerId.startsWith('filler-for-');
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generateRoundPairings — TieredPointsOnly, round 2', () => {
  const realIds = ['real-p1', 'real-p2', 'real-p3', 'real-p4', 'real-p5'];

  test('fillers appear only in the bottom tier table, not in the top tier table', async () => {
    // 5 real players, UMA: p1=20 > p2=10 > p3=-1 > p4=-5 > p5=-10
    // Top 4 should be [p1, p2, p3, p4] — no fillers
    // Bottom table should be [p5, filler, filler, filler]
    computePlayerUmaMap.mockReturnValue(new Map([
      ['real-p1', 20], ['real-p2', 10], ['real-p3', -1], ['real-p4', -5], ['real-p5', -10]
    ]));

    const round1Pairing = {
      tableNumber: 1,
      players: realIds.slice(0, 4).map(id => ({ player: id }))
    };
    const tournament = buildTournament(realIds, 'TieredPointsOnly', [round1Pairing]);

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
    topIds.forEach(id => expect(isFiller(id)).toBe(false));

    // The other table contains p5 and fillers
    const bottomTable = pairings.find(p => p !== topTable);
    const bottomIds = bottomTable.players.map(pp => pp.player);
    expect(bottomIds).toContain('real-p5');
    expect(bottomIds.filter(isFiller)).toHaveLength(3);
  });

  test('top tier table has no fillers even when fillers have UMA=0 which ranks above negative-UMA real players', async () => {
    // Key case: fillers resolve to UMA=0 via ?? 0; real players p3/p4/p5 all have negative UMA
    // Bug: fillers land in the middle of the sort, displacing real players from the top group
    computePlayerUmaMap.mockReturnValue(new Map([
      ['real-p1', 15], ['real-p2', 8], ['real-p3', -2], ['real-p4', -7], ['real-p5', -12]
    ]));

    const round1Pairing = {
      tableNumber: 1,
      players: realIds.slice(0, 4).map(id => ({ player: id }))
    };
    const tournament = buildTournament(realIds, 'TieredPointsOnly', [round1Pairing]);

    const pairings = await generateRoundPairings(tournament, 2);

    const topTable = pairings.find(p => p.players.every(pp => !isFiller(pp.player)));
    expect(topTable).toBeDefined();

    const topIds = topTable.players.map(pp => pp.player);
    // p3 and p4 have negative UMA but should still be in the top group over fillers (UMA=0)
    expect(topIds).toContain('real-p3');
    expect(topIds).toContain('real-p4');
  });
});

describe('generateRoundPairings — TieredPointsOnly, round 1', () => {
  test('round 1 produces tables when player count is not divisible by 4', async () => {
    const realIds = ['real-p1', 'real-p2', 'real-p3', 'real-p4', 'real-p5'];
    const tournament = buildTournament(realIds, 'TieredPointsOnly');

    const pairings = await generateRoundPairings(tournament, 1);

    // 5 players need 1 filler → 2 tables of 4
    expect(pairings).toHaveLength(2);
    pairings.forEach(p => expect(p.players).toHaveLength(4));

    const allPlayerIds = pairings.flatMap(p => p.players.map(pp => pp.player));
    expect(allPlayerIds).toHaveLength(8);

    const fillerCount = allPlayerIds.filter(isFiller).length;
    expect(fillerCount).toBe(3);
  });
});
