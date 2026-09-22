# Equip From the Profile Page and Saved Flair Loadouts

## State

Complete

## Summary

Flair can only be changed on the Shop page, one slot at a time, and the profile page only displays what is currently equipped. A player cannot see or manage what they own from their own profile, cannot preview combinations of owned items, and cannot save and swap looks. This is a design proposal: an owner-only "My Flair" panel on the profile that equips, unequips and previews owned items, plus a small number of named saved loadouts that apply all four slots in one action.

## Problem Details

**File:** `client/src/pages/Shop.tsx:71-101`

The only equip UI and the live preview logic (`previewUser`, `previewNameColor`, and friends) live inside `Shop.tsx`. Preview is limited to hovering a catalog card, which combines that one item with what is equipped now.

**File:** `client/src/components/profile/UserInfoSection.tsx:98-119`

The profile header renders `equippedFlair` (icon, name color, title) but offers no controls, and `client/src/pages/Profile.tsx:110-124` has no inventory section.

**File:** `server/src/models/User.js:160-169`

Ownership (`purchasedItems`) and the active look (`equippedFlair`) are stored as one set of four slots; there is nowhere to store more than the current look.

**File:** `server/src/routes/shop.js:84-118`

Equip works one slot per request; changing a whole look takes four requests and four separate renders.

## Impact

- Players who own several items re-shop just to change their look, and cannot try owned combinations together.
- There is no way to keep, for example, a "tournament look" and an "everyday look".
- The preview logic exists only inside one page, so any new place that wants it must duplicate it (the earlier `flair/profile-header-flair-logic-duplication` debt was exactly that pattern).

## Suggested Fix

Decisions needed first: how many loadouts (a fixed 3, or gated as a purchasable slot; see `flair/shop-points-sink-and-sellback.md`), and whether loadouts may include retired items the player still owns (recommended yes; depends on `flair/retired-shop-items-cannot-be-unequipped-or-relisted.md`).

1. Extract the preview/equip logic from `Shop.tsx` into a shared hook or component so the Shop and the profile use one implementation, and reuse `isFlairEquipped` from `flairUtils.ts`.
2. Add an owner-only "My Flair" section to the profile (own profile only) listing owned items per slot with equip/unequip and a live preview of the header.
3. Add a `flairLoadouts` array on `User` (name plus the four slot values, capped in length) and endpoints to save, rename, delete and apply a loadout; apply must validate each slot value against owned items of the right category, reusing the validation from `flair/equip-slot-category-not-validated.md`, and update all four slots in one atomic write.
4. Show loadout selection in the panel with a one-click apply.
5. Tests: apply loadout with an item the user does not own (rejected), with a retired owned item (allowed), cap enforcement.

## Related Files

- `client/src/pages/Shop.tsx`
- `client/src/pages/Profile.tsx`
- `client/src/components/profile/UserInfoSection.tsx`
- `client/src/utils/flairUtils.ts`
- `client/src/services/api.ts`
- `server/src/routes/shop.js`
- `server/src/models/User.js`
