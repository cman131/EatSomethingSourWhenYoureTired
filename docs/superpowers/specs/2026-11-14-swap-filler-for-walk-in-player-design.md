# Design: Swap a Filler Player for a Real Walk-In Player

## Problem

Round generation (`roundGenerationService.js`) pads a round with guest "filler" users
(`Filler 1`, `Filler 2`, ...) whenever the active player count isn't divisible by 4. In practice,
sometimes a real person shows up at the venue and physically sits in a filler's seat instead of the
filler being an empty chair — most often a walk-in who never signed up for the tournament. Today
there's no way to correct the record: the filler's guest account keeps the games (and, because
`pointsService.js` explicitly skips guests, the real person never gets credit for having played
them), and the tournament roster never reflects that they were there at all.

This feature lets an admin say, after the fact, "this real person was actually sitting in Filler
N's seat in round X" for however many rounds that was true, and have the system correct both the
historical record and the pairings/roster going forward.

## Scope

Locked in during design review:

- **Only available while `tournament.status === 'InProgress'`.** Never for `NotStarted` (no
  rounds/fillers exist yet) or `Completed` (see rationale below) or `Cancelled`.
- **The real player is always a pure walk-in.** They must not already have a
  `tournament.players` entry (active or dropped) or a `waitlist` entry. This endpoint is the
  only way to add a never-signed-up player mid-tournament — the existing `POST
  /:id/players` explicitly rejects once `status !== 'NotStarted'`. Someone who already has a
  roster entry isn't swapped in through this feature.
- **No top4/placement/champion recomputation, ever.** Fillers can never appear in
  `tournament.players` (they're created directly inside pairings by `roundGenerationService.js`
  and `replacePlayerInPairingsWithFiller`, never pushed onto `tournament.players`), so a filler
  could never have been counted toward top4 or placements in the first place. Blocking the whole
  feature once `status === 'Completed'` sidesteps the one case that would have been genuinely
  thorny — recomputing top4 after champion titles/placement points have already been paid, which
  would need reversal logic (revoking an equipped prestige title, clawing back
  `tournament_placement_*` points) that doesn't exist anywhere in the codebase today and isn't
  worth building for this.
- **A given filler identity is not a stable proxy for one person across rounds.**
  `addFillersToPlayerList` looks up an existing guest named `Filler N` by `displayName` and reuses
  it if found, so the *same* `Filler 1` document can appear in round 1 and round 3 of the same
  tournament, representing two different real walk-ins (or a walk-in in one round and an empty
  chair in another). The admin must say, independently for each round, which filler (if any) this
  particular real player was.

## Data model

No schema changes. The swap is a cross-document identity correction:

- `Tournament.rounds[].pairings[].players[].player` — the filler's `ObjectId` is replaced with the
  real player's, same `seat`.
- `Game.players[].player` — same replacement, for the `Game` linked to that pairing (if any).
  `score`/`rank`/`position` are untouched; only identity changes.
- `Tournament.players` — gets a new entry `{ player: realPlayerId, dropped: false }` once per
  swap request, regardless of how many rounds were selected.

The filler's `User` document itself is left alone — it's still a valid guest account that may be
reused for future padding. Nothing deletes or deactivates it.

## Backend design

### `POST /api/tournaments/:id/swap-filler`

`authenticateToken`, `validateMongoId('id')`, `requireAdmin` — admin-only, matching
`reconcile-active-round`'s precedent of gating correction tools behind full admin rather than
tournament-owner-or-admin, since this mutates historical game/points records.

**Request body:**

```jsonc
{
  "realPlayerId": "<User._id>",
  "roundSelections": [
    { "roundNumber": 1, "fillerId": "<User._id of a filler>" },
    { "roundNumber": 3, "fillerId": "<User._id of a filler>" }
  ]
}
```

**Validation (in order, each a 400 unless noted):**

1. Tournament exists (404 if not) and `status === 'InProgress'`.
2. `roundSelections` is a non-empty array.
3. `roundSelections` has no duplicate `roundNumber` (one real player can't occupy two seats in
   the same round).
4. `realPlayerId` resolves to a real (`isGuest !== true`) `User` (404 if missing, 400 if guest).
5. `realPlayerId` is **not** already in `tournament.players` (any state, including dropped) and
   not in `tournament.waitlist`. Rejected with a message pointing at the normal add-player /
   re-signup flow instead.
6. For each `roundSelections` entry: the round exists on the tournament, has `pairings`, and one
   of those pairings currently has a player entry whose `player` equals `fillerId`. Otherwise 400
   naming the offending round.
7. For each selection whose matched pairing has **no** `game` set (i.e. it's an in-progress,
   not-yet-played table): if *any* pairing in that same round already has a `game`, reject the
   whole request (400) — mirrors the existing `/rounds/:roundNumber/reset` rule that a round
   can't be touched once any table in it has reported a result. The admin has to wait for the
   round to fully end (or for it to still be entirely unplayed) before swapping a seat that's
   mid-round.

All validation runs against the fetched tournament before any mutation, so the request either
fully applies or fully fails — no partial round updates.

**Processing**, selections sorted ascending by `roundNumber` so completed rounds are corrected
before the active round is regenerated (the active round's UMA-based grouping, where applicable,
needs the corrected history):

For each selection where the matched pairing **has** a `game`:
- Swap `pairing.players[i].player` to `realPlayerId` in the pairing. Independently, find the
  entry in `game.players[]` whose `player` equals `fillerId` (matched by player id, not array
  index — `Game.players` and `pairing.players` aren't guaranteed to be in the same order) and set
  its `player` to `realPlayerId` too. `score`/`position`/`rank` on that entry are untouched. Save
  the `Game` document.
- Best-effort, caught and logged individually so one failure doesn't block the rest of the
  request (matching the existing pattern in `rounds/:roundNumber/end` for point-award failures):
  - `awardGamePoints(game, game.verifiedBy)` — already guest-aware and idempotent per
    `(user, type, gameId)`, so this simply pays out what was skipped for the filler.
  - If `game.isRanked`: `updateRankedPoints(game)` — already a no-op for a player not enrolled in
    the current `RankedLeague`, and idempotent via `appliedGames`. Since this `Game._id` was
    already pushed onto `league.appliedGames` under the filler's presence (if ranked and
    verified), `hasAppliedGame` would short-circuit to `retryQualificationPoints` and skip the
    actual point delta — **this is a known gap**, flagged in Edge Cases below, not silently
    glossed over.

For each selection where the matched pairing has **no** `game` (the active/in-progress round):
- Ensure `realPlayerId` has been added to `tournament.players` (see below — happens once,
  regardless of how many selections needed it).
- Regenerate that round's `pairings` from scratch via the existing
  `generateRoundPairings(tournament, roundNumber)`, same as the automatic next-round generation
  in `rounds/:roundNumber/end`. The filler is never in `tournament.players`, so it's automatically
  excluded from the new active pool; padding math (`addFillersToPlayerList` /
  `incompletePairing`) recalculates the right number of fillers needed for the new headcount.
  `round.startDate` is left untouched (if the round had already been started, it still has been —
  only who's playing where changes).

After all selections are processed: if `realPlayerId` isn't already in `tournament.players` (i.e.
every selection was a completed-round swap and none needed to touch the active round), push
`{ player: realPlayerId, dropped: false }` now. This is the "ensure exactly once" step — it may
already have happened as part of the active-round regeneration step above; it's not done twice.

`tournament.markModified('rounds')` / `markModified('players')` as needed, then one
`tournament.save()`.

**Response:** same shape as every other tournament-mutation endpoint —
`{ success: true, message, data: { tournament } }`, populated the same way
`reconcile-active-round` populates (`players.player`, `waitlist.player`, `createdBy`,
`rounds.pairings.players.player`, then `prepareTournamentForResponse`).

### Known gap: ranked-league point delta for an already-applied game

`updateRankedPoints`'s idempotency key is `league.appliedGames` containing the `Game._id`, not a
per-player marker. If a ranked game was verified while the filler sat in it, the game's `_id` is
already in `appliedGames` (the filler itself was skipped for credit since it's never in
`league.players`, but the *game* is still marked applied). After the swap, calling
`updateRankedPoints(game)` again sees `hasAppliedGame(league, game) === true` and takes the
`retryQualificationPoints` branch only — it will never retroactively add the real player's
`rankedPoints`/`gamesPlayed` delta for that game, even though the player ID has changed. This is
called out rather than worked around: fixing it would mean changing `updateRankedPoints`'s
idempotency granularity (per-game → per-game-per-player), which is a real behavior change to
ranked-league bookkeeping outside this feature's blast radius. Out of scope here; left as a
documented limitation. (Regular tournament game points via `awardGamePoints` are unaffected by
this gap — that idempotency key is already `(user, type, gameId)`, i.e. per player.)

## Frontend design

### New component: `client/src/components/tournaments/SwapFillerModal.tsx`

Two-step modal (vs. `AddPlayerModal`'s single-step "search → immediately add"), because this
flow needs a second input (the per-round filler mapping) before it can submit:

1. **Pick the real player.** Same debounced user-search pattern as `AddPlayerModal`
   (`usersApi.searchUsers`), filtered to exclude guests and anyone already in
   `tournament.players` or `tournament.waitlist` (client-side mirror of the server's "pure
   walk-in only" rule — a clear, early error rather than a round-trip rejection).
2. **Pick filler seats per round.** Once a player is selected, compute from
   `tournament.rounds` the set of rounds that currently have at least one pairing containing a
   player whose `player.isGuest === true` (a filler). Rounds with no filler seats aren't shown —
   nothing to pick there. For each such round, render a `<select>`:
   `— not this round —` (default) or one option per filler found in that round, labeled with
   enough to disambiguate multiple fillers in the same round, e.g. `Filler 1 — Table 2, East`.
3. Submit disabled until at least one round has a non-default selection. On submit, calls the new
   `tournamentsApi.swapFiller(tournamentId, { realPlayerId, roundSelections })` and closes on
   success, surfacing the server's error message on failure (same pattern as
   `AddPlayerModal.handleSelectPlayer`'s try/catch).

### `TournamentDetail.tsx`

New admin action, visible only when `user?.isAdmin && tournament.status === 'InProgress'`,
alongside the existing `Reconcile active round` button. Opens `SwapFillerModal`; on success,
refetches/replaces the tournament state the same way `handleReconcileActiveRound` and
`handleAddPlayer` already do.

### `client/src/services/api.ts`

```ts
swapFiller: async (
  tournamentId: string,
  payload: { realPlayerId: string; roundSelections: { roundNumber: number; fillerId: string }[] }
) => {
  return apiRequest<ApiResponse<{ tournament: Tournament }>>(`/tournaments/${tournamentId}/swap-filler`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
},
```

`Tournament.rounds` is currently typed `any[]`. The modal needs to read
`round.roundNumber` / `round.pairings[].players[].player.isGuest` /
`round.pairings[].tableNumber` / `round.pairings[].players[].seat` /
`round.pairings[].game`. Minimal typed interfaces (`TournamentRound`, `TournamentPairing`,
`TournamentPairingPlayer`) are added for this, replacing the `any[]` — not a wider typing pass
over every existing `rounds` consumer, just enough for the new modal to be type-safe.

## Data Flow

```
Admin opens SwapFillerModal
  → searches & picks real walk-in player
  → modal derives filler-occupied rounds from the already-loaded tournament
  → admin maps 0+ rounds to specific fillers
  → POST /tournaments/:id/swap-filler
      → validate (status, roundSelections shape, player eligibility, filler presence, active-round-has-games guard)
      → for each completed-round selection (ascending roundNumber):
          swap pairing + game player id → save game → best-effort award/ranked replay
      → for each active-round selection:
          ensure realPlayerId in tournament.players → regenerate round pairings
      → ensure realPlayerId in tournament.players (if not already done)
      → tournament.save()
      → respond with populated tournament
  → TournamentDetail re-renders with corrected roster/rounds
```

## Edge Cases

- **Filler appears twice across selected rounds (same `fillerId`, two different
  `roundNumber`s):** both are valid and independent — exactly the scenario this feature exists
  for (the same filler slot was a different, or the same, walk-in in different rounds).
- **Real player was present for a round that needed *no* filler** (table came out even that
  round): nothing to select — that round simply doesn't appear in the modal. Their UMA for that
  round is whatever it already was as... nothing; they weren't recorded as playing, and this
  feature has no record to correct there. Not a bug, just outside what can be known from the
  data.
- **Active round reshuffle moves other real players to different tables/opponents:** expected
  and intended per the approved design (full re-pairing, not a 1:1 seat swap) — everyone else's
  table assignment for that round can change, not just the swapped seat.
- **Active round already has one table's game submitted when the request arrives:** rejected
  entirely (validation step 7) before any mutation happens, including any completed-round
  selections in the same request — the admin resubmits once the round either fully ends or is
  still entirely unplayed.
- **Tournament completes (`status` flips to `Completed`) between the admin opening the modal and
  submitting:** request re-validates status server-side and rejects; client surfaces the error.
- **Ranked game whose point delta can't be retroactively applied** (see Known Gap above): the
  swap still corrects identity, pairing history, and ordinary game/tournament points; the ranked
  delta for that specific game is the one thing that doesn't retroactively land.

## Testing

**Server (`server/src/routes/tournaments.swapFiller.test.js` or similar, following the existing
`tournaments.reset.test.js` / `tournaments.endRound.test.js` naming):**
- Rejects when tournament isn't `InProgress` (each of `NotStarted`/`Completed`/`Cancelled`).
- Rejects when `realPlayerId` is a guest, or already in `players`/`waitlist`.
- Rejects duplicate `roundNumber`s in `roundSelections`.
- Rejects a `fillerId` not present in the named round.
- Rejects when the active round has any pairing with a `game` and a selection targets it.
- Completed-round swap: pairing and linked `Game.players` both updated; `awardGamePoints` lands
  (assert a `PointTransaction` now exists for the real player for that game); a second swap
  request covering the same round is harmless (idempotent re-award, no duplicate transactions).
- Ranked completed-round swap: `updateRankedPoints`'s known no-op behavior is asserted
  explicitly (not just unchecked) so a future fix to the gap has a failing test to update.
- Active-round selection: `tournament.players` gains exactly one new entry; round's `pairings` are
  regenerated (table count matches new headcount, old filler is no longer present anywhere in the
  round); `round.startDate` unchanged if it was already set.
- Multi-round request mixing a completed-round swap and an active-round reshuffle in one call:
  processed in ascending order, both effects present, one `tournament.save()`.

**Client (`SwapFillerModal.test.tsx`):**
- Renders only rounds that contain a filler; omits rounds with none.
- Disambiguates two fillers in the same round with distinct, selectable labels.
- Submit stays disabled until at least one round has a real selection.
- Submit payload shape matches the API contract; success path closes the modal and surfaces the
  updated tournament; failure path shows the server's error message.

## Non-Goals

- Recomputing top4, tournament placements, or champion titles (see Scope).
- Fixing the ranked-league per-game idempotency granularity (see Known Gap) — documented, not
  patched here.
- Supporting a swap target who is already registered (dropped or otherwise) — out of scope per
  the approved design; a different flow already covers re-adding a dropped or waitlisted player.
- Any change to how fillers are created or named during normal round generation.
