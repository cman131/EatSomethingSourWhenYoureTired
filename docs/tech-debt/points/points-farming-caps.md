# Point Farming Caps: Uncapped Earning from Colluding Accounts

## State

New

## Summary

Nothing limits how many points one player, or one small group, can earn from verified games. Any two accounts can submit and verify games for each other indefinitely, each fake game paying real points, and the submitter can then delete the game. This is a design proposal rather than a bug in existing code: it needs a policy decision about acceptable earning rates before implementation. The points now buy cosmetics only, so the harm is fairness rather than money, but the shop's premium items are meant to signal effort, and cheap farming undermines that.

## Problem Details

**File:** `server/src/utils/pointsService.js:46-60`

Placement is 10/7/4/2, plus 2 for submitting and 1 for verifying, so one verified game pays 26 points across its participants:

```js
const GAME_PLACEMENT_AMOUNTS = { 1: 10, 2: 7, 3: 4, 4: 2 };
const GAME_SUBMITTED_AMOUNT = 2;
const GAME_VERIFIED_AMOUNT = 1;
```

A colluding pair that also fills the other two seats with non-earning players can keep up to 20 of those 26 points per game (to confirm: whether `createGame` in `server/src/utils/gameService.js` restricts who may fill a seat; `awardPoints` already skips guests at `pointsService.js:6-8`). At those rates one premium item (300 points) costs about 15 fake games.

**File:** `server/src/routes/games.js:287-293`

The only integrity check is that the verifier is an in-game player who is not the submitter (or an admin or tournament creator). There is no rate limit, no cap on repeated groups, and no minimum time between submission and verification.

**File:** `server/src/routes/games.js:591-633`

The submitter can delete the game afterwards and the points stay (see `points/verified-game-delete-edit-no-points-reconciliation.md`).

## Impact

- The fastest route to premium flair can be fabricating games rather than playing.
- Stats and the ranked ladder are also polluted by fabricated games; the points cap only limits the cosmetic side of that.
- Any future earning path (`points/new-earning-paths-quizzes-and-streaks.md`) inherits the same exposure unless a shared cap mechanism exists.

## Suggested Fix

Decisions needed first (put answers in this plan before implementing):

- What is a realistic ceiling? For example, the most verified games one player can legitimately play per day, and whether in-person club nights differ from online play.
- Should tournament games (which have their own tournament awards) be exempt from the cap?
- Cap by amount of points per day, by number of point-earning games per day, or both?

Then, a layered approach that can ship incrementally:

1. Add a shared cap helper in `pointsService` that sums a user's earn transactions of given types since a cutoff and truncates or skips an award that would exceed the cap. Use it for game awards first; make it reusable for the earning paths plan.
2. Add a repeat-group limit: reduce or skip points when the same set of four players (or the same submitter/verifier pair) has already produced N point-earning games in a window.
3. Record a `reason` on skipped awards (for example a `capped` marker in logs, not a ledger row) so admins can see what happened; surface it in the admin tooling in `points/admin-point-adjustment-and-ledger-reconciliation.md`.
4. Optional: require a minimum age (for example a few minutes) between game creation and verification before points pay out.
5. Update `PointsHelpModal.tsx` to state the caps so players are not surprised.
6. Tests for each cap, including the boundary and tournament-exempt cases.

## Related Files

- `server/src/utils/pointsService.js`
- `server/src/utils/pointsService.test.js`
- `server/src/utils/gameService.js`
- `server/src/routes/games.js`
- `server/src/models/PointTransaction.js`
- `client/src/components/PointsHelpModal.tsx`
