# Placement-Based Game Points & Points Help Modal

## Overview

Replace the flat "played a game" points award with placement-based rewards, reduce admin-action point values, and add a comprehensive help modal to the Points page explaining all earning sources.

## Backend Changes

### PointTransaction model (`server/src/models/PointTransaction.js`)

Add four new enum values to `POINT_TRANSACTION_TYPES`:
- `game_placement_1`
- `game_placement_2`
- `game_placement_3`
- `game_placement_4`

Keep `game_played` in the enum — existing transactions in the database must remain valid. No new transactions will use this type going forward.

### pointsService.js (`server/src/utils/pointsService.js`)

Replace the flat `game_played` loop in `awardGamePoints` with a rank-driven award:

| Rank | Transaction type | Points |
|------|-----------------|--------|
| 1st  | `game_placement_1` | +8 |
| 2nd  | `game_placement_2` | +5 |
| 3rd  | `game_placement_3` | +3 |
| 4th  | `game_placement_4` | +1 |

Each player entry on the `game.players` array already has a `rank` field (1–4, computed by the Game model's pre-save hook, highest score = rank 1). `awardGamePoints` reads `player.rank` to pick the correct type and amount.

Also update:
- `game_submitted`: 10 → 5
- `game_verified`: 5 → 2

### Tests (`server/src/utils/pointsService.test.js`)

Update existing `awardGamePoints` tests to supply `rank` on each player entry and assert placement-based amounts. Remove the `game_played` test cases; add cases for each of the four placement types. Update the "submitter gets both" balance assertion (was 15 = 5+10, new value depends on submitter's rank + 5).

## Frontend Changes

### Points.tsx label map (`client/src/pages/Points.tsx`)

Add labels for the four new types:
- `game_placement_1`: `'Game 1st Place'`
- `game_placement_2`: `'Game 2nd Place'`
- `game_placement_3`: `'Game 3rd Place'`
- `game_placement_4`: `'Game 4th Place'`

Keep `game_played: 'Game Played'` for backward-compatible rendering of legacy history rows.

Add a "?" icon button next to the "Club Points" `<h1>` that opens the help modal. Wire `useState` to track open/closed state.

### PointsHelpModal component (`client/src/components/PointsHelpModal.tsx`)

A full-screen backdrop overlay modal with three content sections:

**Games**
| Action | Points |
|--------|--------|
| 1st place | +8 |
| 2nd place | +5 |
| 3rd place | +3 |
| 4th place | +1 |
| Submit a game | +5 |
| Verify a game | +2 |

**Tournaments**
| Action | Points |
|--------|--------|
| Participate | +15 |
| 1st place | +40 |
| 2nd place | +30 |
| 3rd place | +20 |
| 4th place | +10 |

**Ranked League**
| Action | Points |
|--------|--------|
| Qualify (join league) | +10 |
| Season placements | Coming soon |

Closes via X button in the top-right corner or clicking outside the modal (backdrop click).

### Tests (`client/src/pages/__tests__/Points.test.tsx`)

- Update the mock history fixture to use `game_placement_1` instead of `game_played` and assert `'Game 1st Place'` renders.
- Add a test: clicking the "?" button renders the modal with expected section headings.
- Add a test: clicking the backdrop/X closes the modal.

## Point Values Reference (post-change)

| Source | Type | Points |
|--------|------|--------|
| Game 1st place | `game_placement_1` | +8 |
| Game 2nd place | `game_placement_2` | +5 |
| Game 3rd place | `game_placement_3` | +3 |
| Game 4th place | `game_placement_4` | +1 |
| Submit a game | `game_submitted` | +5 |
| Verify a game | `game_verified` | +2 |
| Tournament participate | `tournament_participated` | +15 |
| Tournament 1st | `tournament_placement_1` | +40 |
| Tournament 2nd | `tournament_placement_2` | +30 |
| Tournament 3rd | `tournament_placement_3` | +20 |
| Tournament 4th | `tournament_placement_4` | +10 |
| Ranked league qualify | `ranked_league_qualified` | +10 |
| Shop purchase | `shop_purchase` | (spend) |
