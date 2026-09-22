# New Earning Paths: Quiz Completion and Streaks/Weekly Goals

## State

InProgress

## Summary

Points currently come only from playing games, tournaments and ranked qualification (which reward the same behavior: playing). The site's learning tools (discard and decision quizzes) and regular attendance earn nothing, so the economy does not reward the educational side of the app or steady participation. This is a design proposal for two capped earning paths, quiz completion and streak/weekly-goal bonuses, plus the one structural cleanup they need: a single source of truth for award amounts, which today are duplicated by hand in the help modal.

## Problem Details

**File:** `server/src/routes/decisionQuizzes.js:319-374` and `server/src/routes/discardQuizzes.js:328`

Quiz responses are already recorded once per user per quiz (`alreadyResponded` check, `decisionQuizzes.js:362-374`), keyed by a deterministic quiz `id`. That gives a natural dedupe key (`user + quizId`) but the handlers award nothing. Note `GET /generate/random` (`decisionQuizzes.js:105`, `discardQuizzes.js:113`) can produce new quizzes on demand, so an uncapped reward would be trivially farmable (see `points/points-farming-caps.md`).

**File:** `client/src/components/PointsHelpModal.tsx:7-22` vs `server/src/utils/pointsService.js:46-71`

The amounts shown to players are hardcoded a second time on the client (`GAME_ROWS`, `TOURNAMENT_ROWS`). Adding a path means editing both, and nothing detects drift. This conflicts with the rule in `.claude/rules/rules.md` that domain values have one canonical source.

**File:** `server/src/models/PointTransaction.js:3-18` and `:35-40`

New earn types must be added to `POINT_TRANSACTION_TYPES`, and any new source key (for example `quizId`) must be declared in `metadata` or Mongoose strict mode drops it (the same bug that loses `itemId`, see `points/points-history-missing-context-and-paging.md`).

**Constraint:** `.claude/rules/context.md` says there are no background jobs or queues, so streaks and weekly goals must be evaluated inline when an earning event happens, not by a scheduler.

## Impact

- The quiz features have no incentive loop, so usage depends purely on intrinsic interest.
- Players who attend regularly but lose most games earn little (4th place pays 2), so regulars fall behind luckier players.
- Any new earn path added the current way will drift out of sync with the help modal.

## Suggested Fix

Decisions needed first:

- Does a quiz have a correct or preferred answer to reward, or is completion the only signal? (Check the quiz model before deciding.)
- Streak unit: consecutive weeks with at least one verified game? Consecutive days on quizzes? Whatever is chosen must be computable from existing data at award time.
- Budget: target average income per active player per week, so the new paths are meant to supplement rather than dominate (the full flair catalog costs 9,375 points; see `flair/shop-points-sink-and-sellback.md`).

Then:

1. Expose the amounts from one server-side config module and serve them to the help modal (endpoint or shared constants) so the modal is generated, not typed.
2. Add `quiz_completed` (and streak/weekly-goal types) to the enum, declare `quizId` etc. in `metadata`, and add labels in `Points.tsx`.
3. Award quiz points on first response only, through the idempotent `awardPointsOnce` mechanism, behind the shared daily cap from `points/points-farming-caps.md`.
4. Evaluate streaks and weekly goals inside the existing award path (after a verified game), recording the goal window in `metadata` so it pays once per window.
5. Tests: idempotent quiz award, cap boundary, streak window rollover.

## Related Files

- `server/src/routes/decisionQuizzes.js`
- `server/src/routes/discardQuizzes.js`
- `server/src/utils/pointsService.js`
- `server/src/models/PointTransaction.js`
- `client/src/components/PointsHelpModal.tsx`
- `client/src/pages/Points.tsx`
- `client/src/components/__tests__/PointsHelpModal.test.tsx`
