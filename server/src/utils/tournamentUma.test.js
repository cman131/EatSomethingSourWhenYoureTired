const { computePlayerUmaMap } = require('./tournamentUma');

const PLAYER_ID = 'abc123def456789012345678';

function makeGame(score, rank) {
  return { verified: true, players: [{ player: PLAYER_ID, score, rank }] };
}

// UMA math reference:
//   umaBase = (score - startingPoint) / 1000
//   adjustment: rank1=+30, rank2=+10, rank3=-10, rank4=-30
//   round1(32000,r1): (2) + 30 = 32
//   round2(28000,r3): (-2) + (-10) = -12
//   round3(35000,r1): (5) + 30 = 35

describe('computePlayerUmaMap', () => {
  test('uses preliminaryRoundCount to classify prelim rounds when maxRounds virtual has drifted', () => {
    // Simulates: tournament started with 16 players (preliminaryRoundCount=2),
    // but enough players dropped to make maxRounds virtual = 1.
    // Regular-round UMA must still include round 2 as a prelim round.
    const tournament = {
      startingPointValue: 30000,
      preliminaryRoundCount: 2,
      maxRounds: 1,
      rounds: [
        { roundNumber: 1, pairings: [{ game: makeGame(32000, 1) }] },
        { roundNumber: 2, pairings: [{ game: makeGame(28000, 3) }] },
        { roundNumber: 3, pairings: [{ game: makeGame(35000, 1) }] },
      ],
      umaPenalties: [],
    };

    const map = computePlayerUmaMap(tournament);
    // rounds 1 and 2 are prelim: 32 + (-12) = 20
    expect(map.get(PLAYER_ID)).toBe(20);
  });

  test('uses preliminaryRoundCount as finals boundary in finalsOnly mode', () => {
    const tournament = {
      startingPointValue: 30000,
      preliminaryRoundCount: 2,
      maxRounds: 1,
      rounds: [
        { roundNumber: 1, pairings: [{ game: makeGame(32000, 1) }] },
        { roundNumber: 2, pairings: [{ game: makeGame(28000, 3) }] },
        { roundNumber: 3, pairings: [{ game: makeGame(35000, 1) }] },
      ],
      umaPenalties: [],
    };

    const map = computePlayerUmaMap(tournament, { finalsOnly: true });
    // only round 3 is finals: 35
    expect(map.get(PLAYER_ID)).toBe(35);
  });

  test('falls back to maxRounds when preliminaryRoundCount is not set', () => {
    const tournament = {
      startingPointValue: 30000,
      maxRounds: 2,
      rounds: [
        { roundNumber: 1, pairings: [{ game: makeGame(32000, 1) }] },
        { roundNumber: 2, pairings: [{ game: makeGame(28000, 3) }] },
        { roundNumber: 3, pairings: [{ game: makeGame(35000, 1) }] },
      ],
      umaPenalties: [],
    };

    const map = computePlayerUmaMap(tournament);
    // rounds 1 and 2 are prelim: 32 + (-12) = 20
    expect(map.get(PLAYER_ID)).toBe(20);
  });
});
