/**
 * Computes each player's UMA from verified games in (optionally finals-only) rounds,
 * minus their umaPenalties total.
 * @param {Object} tournament - Tournament doc with rounds.pairings.game populated (game.players with score, rank).
 * @param {{ finalsOnly?: boolean }} options - If finalsOnly, only sum UMA from rounds where roundNumber > maxRounds.
 * @returns {Map<string, number>} playerId string -> effective UMA (game sum - penalties).
 */
function computePlayerUmaMap(tournament, finalsOnly = false) {
  const map = new Map();
  const startingPoint = tournament.startingPointValue ?? 30000;
  const maxRounds = tournament.maxRounds ?? 0;

  if (!tournament.rounds || !Array.isArray(tournament.rounds)) {
    return map;
  }

  for (const round of tournament.rounds) {
    if ((finalsOnly && round.roundNumber <= maxRounds) || (!finalsOnly && round.roundNumber > maxRounds)) continue;
    if (!round.pairings || !Array.isArray(round.pairings)) continue;

    for (const pairing of round.pairings) {
      const game = pairing.game;
      if (!game || typeof game !== 'object' || !game.verified) continue;
      if (!game.players || !Array.isArray(game.players)) continue;

      const rankUmaAdjustment = { 1: 30, 2: 10, 3: -10, 4: -30 };

      for (const gp of game.players) {
        const raw = gp.player;
        const playerId = raw == null ? null : (typeof raw === 'string' ? raw : (raw._id != null ? raw._id.toString() : raw.toString()));
        if (!playerId) continue;
        const umaBase = (Number(gp.score) - startingPoint) / 1000;
        const rank = gp.rank != null ? gp.rank : 0;
        const adjustment = rankUmaAdjustment[rank] ?? 0;
        const uma = umaBase + adjustment;
        map.set(playerId, (map.get(playerId) ?? 0) + uma);
      }
    }
  }

  // Subtract penalties per player
  const penalties = tournament.umaPenalties ?? [];
  for (const p of penalties) {
    const playerId = p.player && (typeof p.player === 'string' ? p.player : p.player.toString && p.player.toString());
    if (!playerId) continue;
    const amount = Number(p.amount) || 0;
    map.set(playerId, (map.get(playerId) ?? 0) + amount);
  }

  return map;
}

module.exports = {
  computePlayerUmaMap
};
