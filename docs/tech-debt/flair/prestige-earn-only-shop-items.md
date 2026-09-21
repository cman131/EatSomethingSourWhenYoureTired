# Prestige: Earn-Only and Limited-Time Flair Items

## State

New

## Summary

Every flair item is purchasable by anyone with enough points, so flair signals only "has spent points", never "did something notable". Tournament winners and ranked-season champions get points but nothing that shows it on their name. This is a design proposal for a second way to obtain items: earn-only items granted for achievements (tournament win, season champion), and limited-time items that are purchasable only in a window but stay owned forever. The current data model has no concept of either.

## Problem Details

**File:** `server/src/models/ShopItem.js:11-16`

An item has `cost`, `tier` and a boolean `isActive` only. Tiers are `entry | mid | premium`; there is no acquisition method, availability window or unlock rule.

**File:** `server/src/routes/shop.js:47-81`

The only way to gain an item is `POST /purchase`, which spends points. There is no grant path that adds an item without spending.

**File:** `server/src/models/User.js:160-163`

`purchasedItems` entries hold `item` and `purchasedAt` only; there is nowhere to record why an item was granted (for example "Season 3 champion").

**File:** `server/src/utils/pointsService.js:73-102`

`awardTournamentPoints` already runs at tournament completion with the top four in hand, and season end will have final standings (`points/ranked-season-end-placement-rewards.md`); these are the two natural grant points.

**File:** `docs/flair-style-guide.md:5-20`

The style guide defines three tiers. A visibly distinct prestige tier would need its own visual language, and each new tier must be added to the guard tests (`flairCatalog.test.ts`, `shopCatalog.test.js`).

## Impact

- Winning a tournament or a season has no lasting visual reward, weakening the incentive to compete.
- Flair cannot communicate history or status, only spending.
- There is no way to run seasonal or event items without permanently changing the catalog.

## Suggested Fix

Decisions needed first: which achievements grant items (tournament winner? top 3? season champion?), whether items are per-event (for example one title per season, which multiplies catalog entries) or reusable, and whether a prestige tier gets its own styling.

1. Extend `ShopItem` with an acquisition type (`shop` vs `earned`) and optional availability window (`availableFrom`, `availableUntil`), and make `GET /api/shop` list only currently purchasable shop items. Earned items are never buyable; the purchase route must reject them.
2. Add `source` (and optional label) to `purchasedItems` entries, and a shared `grantItem(userId, itemId, source)` service that is idempotent (no duplicate grant) and does not touch points.
3. Call `grantItem` from tournament completion and season end, keyed on the tournament or league id so replays are safe.
4. Expired or earned items must stay visible and equippable for their owners, which depends on `flair/retired-shop-items-cannot-be-unequipped-or-relisted.md`.
5. Add catalog entries and matching CSS following the style guide's hard rules (never rename a shipped `value`, reduced-motion and forced-colors fallbacks), and update the guard tests for any new tier or acquisition field.
6. Tests: grant is idempotent, earned items cannot be bought, expired limited items disappear from the shop but stay equipped.

## Related Files

- `server/src/models/ShopItem.js`
- `server/src/models/User.js`
- `server/src/routes/shop.js`
- `server/src/utils/pointsService.js`
- `server/src/utils/rankedLeagueService.js`
- `server/src/data/shopCatalog.js`
- `server/src/data/shopCatalog.test.js`
- `client/src/pages/Shop.tsx`
- `client/src/utils/flairUtils.ts`
- `client/src/styles/flair.css`
- `docs/flair-style-guide.md`
