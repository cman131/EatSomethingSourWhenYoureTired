# New Profile Slots: Backdrop/Banner and a Pinned Showcase

## State

New

## Summary

Every flair category today decorates the name or avatar (color, icon, border, title), so profiles look alike beyond those four accents, and there is nothing that lets a player express their play or history. This is a design proposal for two additions: a purchasable profile backdrop (a banner behind the profile header) as a fifth flair category, and a "showcase" where a player pins a few items or stats they are proud of. Adding a category touches many hand-synced lists, so the plan enumerates them.

## Problem Details

**File:** `server/src/models/ShopItem.js:6-10`, `server/src/routes/shop.js:9`, `server/src/models/User.js:164-169`, `client/src/services/api.ts:751` and `:767-772`

The four category names are repeated in the ShopItem enum, the route's `VALID_SLOTS`, the `equippedFlair` schema, and the client `FlairCategory` / `EquippedFlair` types. A new slot must be added to all of them (and to the tab list at `client/src/pages/Shop.tsx:20-25`).

**File:** `server/src/models/User.js:266`

`PLAYER_POPULATE_FIELDS` includes `equippedFlair`, so every game, tournament and member list carries flair for each player. A backdrop is only ever shown on the profile, so it should not ride along on those payloads.

**File:** `client/src/components/profile/UserInfoSection.tsx:98-119` and `:127-`

The profile header is a plain card; the "Additional Information" grid already shows `favoriteYaku`, `favoriteTile` and riichi music (`User.js:66-75`, `:140-151`), which are the only self-expression fields today.

**File:** `docs/flair-style-guide.md:22-35`

Hard rules constrain any new category: tiered visuals (entry static, mid richer, premium animated), never rename a shipped `value`, `prefers-reduced-motion`, forced-colors and print fallbacks, and guard tests (`client/src/utils/__tests__/flairCatalog.test.ts`, `server/src/data/shopCatalog.test.js`) that fail when lists drift.

**File:** `server/src/models/User.js:238-263`

`toJSON` in private mode does not touch `equippedFlair`; whether a private profile shows a backdrop or showcase is undecided.

## Impact

- Without a larger canvas, profile customization is limited to four small accents, capping how much the shop can offer.
- Players have no way to feature achievements or preferences beyond a fixed list of fields.

## Suggested Fix

Decisions needed first: does a private-mode profile show a backdrop; what may be pinned in the showcase (the achievement system was removed in `docs/completed-tech-debt/users/remove-achievement-system.md`, so the showcase should pin things that already exist: owned flair, favorite yaku/tile, and computed stats such as best ranked finish or tournaments won, not new badges).

1. Backdrop: add a `profileBackdrop` category end to end (list above), with entry/mid/premium visuals per the style guide, rendered behind the `UserInfoSection` header only. Serve the value via the user profile response rather than `PLAYER_POPULATE_FIELDS`.
2. Add catalog items and CSS (`client/src/styles/flair.css`), the style guide section, and the registry in `flairUtils.ts`; extend the guard tests to cover the new category.
3. Showcase: add `showcase` on `User` (a short list of typed entries, capped at roughly three), a picker on the owner's profile, and a display block on profiles. Validate that pinned flair entries are owned.
4. Apply the visibility decision for private mode consistently (see `points/user-endpoint-exposes-points-and-purchases.md` for the response-contract work this depends on).
5. Tests for validation, private-mode handling and the drift guards.

## Related Files

- `server/src/models/ShopItem.js`
- `server/src/routes/shop.js`
- `server/src/models/User.js`
- `server/src/data/shopCatalog.js`
- `server/src/data/shopCatalog.test.js`
- `client/src/services/api.ts`
- `client/src/pages/Shop.tsx`
- `client/src/components/profile/UserInfoSection.tsx`
- `client/src/utils/flairUtils.ts`
- `client/src/utils/__tests__/flairCatalog.test.ts`
- `client/src/styles/flair.css`
- `docs/flair-style-guide.md`
