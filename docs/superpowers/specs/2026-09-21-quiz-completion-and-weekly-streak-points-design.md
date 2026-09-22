# Design: Quiz Completion & Weekly Streak Points

Source tech-debt plan: `docs/tech-debt/points/new-earning-paths-quizzes-and-streaks.md`

## Problem

Points currently come only from playing games, tournaments, and ranked qualification — all rewarding the same behavior. The educational tools (decision/discard quizzes) earn nothing, and regular attendance earns nothing beyond whatever a player's placements happen to pay. Separately, award amounts are hand-duplicated between `pointsService.js` and `PointsHelpModal.tsx` with nothing to catch drift.

## Decisions (resolved in brainstorming)

Resolved from the existing code, no product input needed:
- **No "correct answer" signal exists.** Neither `DecisionQuiz` nor `DiscardQuiz` records a correct/optimal choice — `responses` only tracks which tile each user picked. Completion is the only signal available.
- **The weekly/streak trigger is attendance-anchored**, not quiz-anchored, per the source plan's own Suggested Fix step 4.
- **No dependency on `points/points-farming-caps.md`.** That plan is mid-flight in a sibling worktree, unmerged to `main`. The new paths get their own small, self-contained cap; consolidating with a shared cap helper later (once that plan merges) is a followup, not a blocker here.

Decided with the user:
- Three weekly goals — a verified game, a completed quiz, and a site visit that week — are **all-or-nothing**: the week only counts toward the streak if all three happen.
- "Visited the site" is detected by piggybacking on the existing `authenticateToken` middleware (no new endpoint, no analytics table).
- The streak bonus **escalates** with consecutive qualifying weeks, capped at a max, and resets on any missed week.
- Quiz completion pays **+1 point**, shared amount for both quiz types.
- Weekly quiz income is capped at **+5 points/week** (5 distinct quizzes).
- Target combined weekly budget for these two paths, for an active regular: **~5–10 points/week** — clearly supplementary to game/tournament income (today averaging ~9 pts/game).

## Architecture

### Single source of truth for award amounts

New `server/src/utils/pointsConfig.js` exports every award amount currently scattered across `pointsService.js` (`GAME_PLACEMENT_AMOUNTS`, `GAME_SUBMITTED_AMOUNT`, `GAME_VERIFIED_AMOUNT`, `TOURNAMENT_PARTICIPATION_AMOUNT`, `TOURNAMENT_PLACEMENT_AMOUNTS`, `RANKED_QUALIFICATION_AMOUNT`, `RANKED_PLACEMENT_AMOUNTS`) plus the two new ones (`QUIZ_COMPLETION_AMOUNT`, `WEEKLY_STREAK_AMOUNTS`). `pointsService.js` imports from it instead of defining constants inline — this closes the drift gap for every path, not just the new ones.

`GET /api/points/config` (new route in `server/src/routes/points.js`) serves this config as JSON. `PointsHelpModal.tsx` fetches it on open and renders table rows from the response instead of the hardcoded `GAME_ROWS`/`TOURNAMENT_ROWS`/`RANKED_ROWS` arrays. Loading/error states follow the existing pattern used elsewhere in the client (explicit loading state, no empty flash).

### Quiz completion (`quiz_completed`)

- New `PointTransaction` type `quiz_completed`, one shared type for both decision and discard quizzes.
- New `metadata.quizId: { type: String, default: null }` field (quiz ids are SHA-256 hash strings, not ObjectIds — unlike every existing metadata field).
- New partial unique index: `{ user: 1, type: 1, 'metadata.quizId': 1 }`, `unique: true`, `partialFilterExpression: { 'metadata.quizId': { $type: 'string' } }` — mirrors the existing `gameId`/`tournamentId`/`leagueId` pattern.
- Awarded via `recordAwardOnce` (not `awardAllOnce`, since this is a single-user award, not a batch) immediately after the existing `alreadyResponded` check passes in both `decisionQuizzes.js:373` and the equivalent block in `discardQuizzes.js`.
- **Weekly cap**: before awarding, sum the user's `quiz_completed` transactions with `createdAt` in the current ISO week (Mon 00:00 UTC–Sun 23:59:59 UTC). If already at 5, skip the award entirely (no zero-amount ledger row — the quiz UI still works normally, it just stops paying). This is the anti-farming measure the source plan flagged as required for the uncapped `GET /generate/random` path.

### Weekly streak (`weekly_streak_bonus`)

- New `PointTransaction` type `weekly_streak_bonus`.
- New `metadata.weekStart: { type: Date, default: null }` (the Monday 00:00 UTC that anchors the week), with a partial unique index `{ user: 1, type: 1, 'metadata.weekStart': 1 }` so a week pays at most once no matter which trigger fires it.
- New `User.lastActiveAt: { type: Date }`, updated in `authenticateToken`: only written when the existing value falls outside the current week, to avoid a write on every authenticated request.
- **Qualification check** for a given `(user, weekStart)`: a verified game in that window (`Game.verifiedAt`), a `quiz_completed` transaction in that window, and `lastActiveAt` inside that window. All three required.
- **Evaluated at two trigger points**: after `awardGamePoints` succeeds for a verified game, and after a `quiz_completed` award succeeds. Anchoring only to game verification (as the source plan's Suggested Fix literally proposed) would miss weeks where the quiz happens after the week's last game — extending the trigger to both award paths closes that gap while staying inline/synchronous (no scheduler, consistent with the "no background jobs" constraint).
- **Streak length** is computed at evaluation time, not cached on `User`: walk backward week by week from the current week through the user's `weekly_streak_bonus` ledger rows, counting consecutive paid weeks, stopping at the first gap. This avoids a mutable counter that could drift from the ledger (matching how `awardRankedSeasonPlacementPoints` derives state from data). The lookback is bounded — it stops at the first missed week, so it's cheap in the common case.
- **Amounts**: +2 (1st consecutive qualifying week) / +3 (2nd) / +4 (3rd) / +5 (4th and beyond, capped).

Documented but not changed: because verifying a game or completing a quiz is itself an authenticated request, the `lastActiveAt` condition is in practice always satisfied whenever the game or quiz condition is. The binding constraint today is really "a verified game and a completed quiz in the same week." `lastActiveAt` stays as an explicit, separately-checked condition for correctness and in case some future path decouples "visiting" from those two specific actions — but the design doc should be honest that it's not currently doing independent work.

### Data model changes

`server/src/models/PointTransaction.js`:
- Add `quiz_completed`, `weekly_streak_bonus` to `POINT_TRANSACTION_TYPES`.
- Add `metadata.quizId` (String) and `metadata.weekStart` (Date) fields, each with its own partial unique index as described above.

`server/src/models/User.js`:
- Add `lastActiveAt: { type: Date }`.

### Client changes

- `client/src/pages/Points.tsx`: add `quiz_completed: 'Quiz Completed'` and `weekly_streak_bonus: 'Weekly Streak Bonus'` to `POINT_TYPE_LABELS`.
- `client/src/components/PointsHelpModal.tsx`: rewritten to fetch `/api/points/config` and render rows dynamically (Games/Tournaments/Ranked League sections keep their current structure; a new "Quizzes" section and a note about the weekly streak bonus are added). Explicit loading and error states per the async-pattern rule in `.claude/rules/rules.md`.
- `client/src/components/__tests__/PointsHelpModal.test.tsx`: rewritten to mock the config fetch instead of asserting hardcoded rows.
- `client/src/services/api.ts`: add a `getPointsConfig()` function alongside the existing `getPointsSummary`/`getPointsHistory` calls.

## Data flow

1. **Quiz completion**: `PUT /:id/response` (decision or discard) → existing validation → existing `alreadyResponded` check → on success, call `awardQuizCompletionPoints(userId, quizId)` → weekly-cap check → `recordAwardOnce` → attempt weekly-streak evaluation for `(userId, currentWeekStart)`.
2. **Game verification**: existing `awardGamePoints(game, verifierId)` call in `games.js` → on success, for each player in the game, attempt weekly-streak evaluation for `(playerId, weekStart-of-verifiedAt)`.
3. **Weekly-streak evaluation** (shared helper): check the three conditions; if all met, compute streak length from the ledger, then `recordAwardOnce` with the corresponding amount and `metadata.weekStart`. The unique index makes re-evaluation from either trigger safe.
4. **Help modal**: `PointsHelpModal` mounts → `GET /api/points/config` → render sections from the response.

## Error handling

- Quiz award and streak evaluation follow the existing pattern in `games.js:311-315`: wrapped in `try/catch`, logged with `console.error`, never blocking the quiz response or game-verification response to the user. A failed award is not silently lost — it can be replayed later the same way `scripts/replayGamePoints.js` replays missed game awards (a replay script for quiz/streak awards is a natural followup but out of scope here; the immediate goal is parity with the existing "don't block the user-facing action" behavior).
- The weekly cap check and streak qualification check are read-then-write (not atomic), same tradeoff already accepted for `spendPoints` and the sibling cap plan — acceptable here given the amounts involved are small and the existing `recordAwardOnce` dedup index is the actual correctness backstop against double-payment.

## Testing

- `quiz_completed` awarded once per `(user, quizId)`, not on a resubmission.
- Weekly quiz cap: 5th distinct quiz that week pays, 6th does not; cap resets the following week.
- Streak qualification: all three conditions required; missing any one (no game, no quiz, or `lastActiveAt` outside the window) pays nothing.
- Streak escalation across 4+ consecutive qualifying weeks reaches and holds the +5 cap.
- Streak reset: a missed week brings the next qualifying week back to +2.
- Dedup: triggering evaluation from both the game path and the quiz path in the same week pays only once (unique index on `weekStart`).
- `GET /api/points/config` returns the full amount set; `PointsHelpModal` renders it, including a loading state and a fetch-failure state.

## Related files

- `server/src/routes/decisionQuizzes.js`
- `server/src/routes/discardQuizzes.js`
- `server/src/routes/games.js`
- `server/src/routes/points.js`
- `server/src/utils/pointsService.js`
- `server/src/utils/pointsConfig.js` (new)
- `server/src/models/PointTransaction.js`
- `server/src/models/User.js`
- `server/src/middleware/auth.js`
- `client/src/components/PointsHelpModal.tsx`
- `client/src/components/__tests__/PointsHelpModal.test.tsx`
- `client/src/pages/Points.tsx`
- `client/src/services/api.ts`
