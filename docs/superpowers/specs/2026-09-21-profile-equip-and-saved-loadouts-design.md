# Design: Equip From the Profile Page and Saved Flair Loadouts

Source tech-debt plan: `docs/tech-debt/flair/profile-equip-and-saved-loadouts.md`

## Problem

Flair (name color, name icon, profile border, title) can only be changed on the Shop page, one
slot at a time. The profile page only displays what is currently equipped, with no controls. A
player cannot see or manage what they own from their own profile, cannot preview combinations of
owned items, and cannot save and swap looks. The preview/equip logic also lives only inside
`Shop.tsx`, so any new consumer (this profile panel) would otherwise have to duplicate it.

## Decisions

- **Loadout cap: fixed at 2.** Enforced through one exported constant
  (`MAX_FLAIR_LOADOUTS = 2` in `flairLoadoutService.js`), not scattered as a literal, so a later
  tech-debt item that lets players purchase additional loadout slots
  (`flair/shop-points-sink-and-sellback.md`, not yet implemented) can raise it in one place.
- **Retired items may be included in loadouts: yes.** Consistent with `/api/shop/equip`, which
  already allows owners to equip/unequip retired (`isActive: false`) items directly
  (`flair/retired-shop-items-cannot-be-unequipped-or-relisted.md`, already completed). Loadout
  slot validation checks ownership + category, not `isActive`.

## Backend

### `server/src/models/User.js`

Add `flairLoadouts`, an array of subdocuments alongside `equippedFlair`:

```js
flairLoadouts: [{
  name:          { type: String, required: true, trim: true, minlength: 1, maxlength: 30 },
  nameColor:     { type: String, default: null },
  nameIcon:      { type: String, default: null },
  profileBorder: { type: String, default: null },
  title:         { type: String, default: null },
}],
```

Same slot shape as `equippedFlair` so the two are trivially interchangeable when applying.

### `server/src/utils/flairLoadoutService.js` (new)

Mirrors the extraction pattern already used by `shopService.js` (a plain module of functions used
by the route handler, since the codebase has no separate service layer, only per-feature
utility modules).

- `MAX_FLAIR_LOADOUTS = 2` — exported constant.
- `validateLoadoutSlots(user, slots)` — for each of the four slots with a non-null value, requires
  a populated `purchasedItems` entry whose `item.category` matches the slot and `item.value`
  matches the given value. Does not check `isActive` (retired items are allowed). Returns
  `{ valid: true }` or `{ valid: false, reason }` naming the first invalid slot.
- `applyLoadout(userId, loadout)` — one atomic `findOneAndUpdate` writing all four
  `equippedFlair.*` fields from the loadout's slot values (mirrors the single-write style of
  `debitAndGrantItem` in `shopService.js`, avoiding four separate `/equip` calls).

### `server/src/routes/shop.js`

New routes, colocated with the existing flair/shop routes:

- `POST /api/shop/loadouts` — body `{ name, nameColor, nameIcon, profileBorder, title }`.
  400 if the user already has `MAX_FLAIR_LOADOUTS` loadouts, or if `validateLoadoutSlots` fails.
  Reuses `VALID_SLOTS`/category-match semantics already proven in `/equip`.
- `PUT /api/shop/loadouts/:loadoutId` — rename and/or replace slot values on an existing loadout
  (same validation as create; no cap check). 404 if the loadout id isn't one of the user's own.
- `DELETE /api/shop/loadouts/:loadoutId` — 404 if not the user's own.
- `POST /api/shop/loadouts/:loadoutId/apply` — re-runs `validateLoadoutSlots` (a `ShopItem` a
  loadout references could be deleted from the catalog entirely between save and apply, orphaning
  the reference) then calls `applyLoadout`. If validation now fails, returns 400 without changing
  `equippedFlair`, rather than partially applying.

All four new routes require ownership (`req.user._id`), matching every other route in this file —
no separate authorization middleware needed beyond the existing `authenticateToken` applied
globally.

## Frontend

### Shared equip/preview hook

Extract the preview-composition and equip/unequip logic currently inline in `Shop.tsx`
(`previewUser`, `previewNameColor`, `previewIcon`, `previewBorder`, `previewTitleItem`,
`handleEquip`, and the `isFlairEquipped` usage) into `client/src/hooks/useFlairEquip.ts`. It takes
the current `equippedFlair`, the owned items, and an optional hovered/previewed item, and returns
the composed preview values plus an `equip`/`unequip` mutator. `Shop.tsx` and the new profile
panel both consume it — no duplicated preview math.

### `client/src/components/profile/MyFlairSection.tsx` (new)

Rendered from `Profile.tsx` only when `isOwnProfile` (own-profile-only, per the plan), placed
alongside `UserInfoSection`. Two parts:

1. **Owned items by slot** — reuses `useFlairEquip` for equip/unequip and a live preview
   (same preview primitives `Shop.tsx` already uses: `FlairName`, `FlairIcon`, `TitleBadge`,
   border classes via `isPremiumBorder`/`isMidTierBorder`).
2. **Saved loadouts** — list of the user's `flairLoadouts` (name + one-click Apply), a "Save
   current look as…" action (name prompt, disabled/explained once at the cap), and per-loadout
   rename/delete. Applying refetches the profile so `equippedFlair` reflects the new look
   everywhere (header, avatar, etc.) via the existing `onRefetchProfile` plumbing already passed
   into `UserInfoSection`.

### `client/src/services/api.ts`

- `FlairLoadout` type: `{ _id: string; name: string } & EquippedFlair`.
- `shopApi.createLoadout(payload)`, `renameLoadout(id, name)`, `updateLoadoutSlots(id, slots)`,
  `deleteLoadout(id)`, `applyLoadout(id)`.
- `ShopInventory` gains `flairLoadouts: FlairLoadout[]` (returned from
  `GET /api/shop/inventory`, so the profile panel can reuse the existing inventory fetch instead
  of a new endpoint).

## Testing

**Server**
- `flairLoadoutService.test.js`: validates owned/unowned items per slot, allows retired owned
  items, rejects wrong-category values, cap constant enforcement helper.
- `shop.test.js` additions: create/rename/delete/apply route tests — cap enforcement at 2,
  apply with an item the user no longer owns (rejected, `equippedFlair` unchanged), apply with a
  retired owned item (allowed), atomicity of the 4-slot write, 404s for another user's loadout id.

**Client**
- `useFlairEquip.test.ts`: preview composition and equip/unequip behavior, extracted from the
  existing inline `Shop.tsx` coverage (no behavior change intended for Shop's own tests).
- `MyFlairSection.test.tsx`: equip/unequip from the profile, save-as-loadout, apply, rename,
  delete, and the cap-reached state, queried via `getByRole`/`getByLabelText`.

## Non-Goals

- Purchasable extra loadout slots (tracked separately in
  `flair/shop-points-sink-and-sellback.md`).
- Sharing/exporting loadouts between users.
