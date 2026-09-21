# Prestige: Earn-Only Flair Items — Design

Source plan: `docs/tech-debt/flair/prestige-earn-only-shop-items.md`.

## Goal

Let players earn a title badge for winning a tournament or a ranked season. Earned items cannot be bought, look visibly different from purchasable flair, and stay owned and equippable forever. Shop items may also carry an availability window so a limited-time item leaves the shop but stays with its owners.

## Decisions

| Question | Decision |
|----------|----------|
| Which achievements grant an item? | Tournament winner (`top4[0]`, not dropped) and ranked season champion (placement 1 among qualified players; ties share placement 1, so all tied players receive it). |
| One reusable item or one per event? | One `ShopItem` per event, created at grant time. |
| Category and look | Titles only, with a new `prestige` tier and one shared badge style. |
| Where do grants hook in? | Tournament completion and the existing ranked season payout. Both triggers already exist on `main`. |
| Limited-time window | `availableFrom` / `availableUntil` on `ShopItem`, honored by the shop list and the purchase route. |

Rejected alternative: storing earned titles as embedded strings on `User`. It would bypass `purchasedItems`, so inventory and equip would need parallel code.

## 1. Data model

`server/src/models/ShopItem.js`
- `acquisition`: `'shop' | 'earned'`, default `'shop'`.
- `availableFrom`, `availableUntil`: optional `Date`, both default `null`. `null` means no bound on that side.
- `sourceKey`: optional `String` with a unique sparse index. Earned items only, e.g. `tournament:<id>` or `league:<id>`.
- `tier` enum gains `'prestige'`.

`server/src/models/User.js`, `purchasedItems` entries
- `source`: optional `{ type: 'tournament' | 'ranked_season', refId: ObjectId, label: String }`. Absent for purchases.

## 2. Grant service

New `server/src/utils/flairGrantService.js` (separate from `shopService.js`, which handles purchasing).

`grantEarnedTitle(userId, { kind, refId, label })`:
1. Upsert the `ShopItem` by `sourceKey = "<kind>:<refId>"` with `acquisition: 'earned'`, `category: 'title'`, `tier: 'prestige'`, `cost: 0`, `value` and `name` set from the label. `sourceKey` is unique, so concurrent callers converge on one row.
2. `User.findOneAndUpdate({ _id, 'purchasedItems.item': { $ne: item._id } }, { $push: { purchasedItems: { item: item._id, source } } })`. This matches the guard used by `purchaseItem`.
3. Never touches `pointsBalance` or the ledger.

Labels use reserved prefixes:
- `Tournament Champion: <tournament name, truncated to 40 chars>`
- `Season Champion: <Mon YYYY>` from the league `startDate` (leagues have no season number).

Two events can yield identical values (same-named tournaments). Dedupe is by `sourceKey`, so both are granted; both then render as equipped when either is. This is accepted.

## 3. Triggers

Tournament (`server/src/routes/tournaments.js`, after `awardTournamentPoints`): grant `top4[0]` unless that player dropped, in its own try/catch that logs and swallows errors, as the points call does.

Season (`server/src/utils/rankedLeagueService.js`, `payEndedSeason`): after `awardRankedSeasonPlacementPoints(claimedLeague)` and inside the same `try`, grant every placement-1 player. A failure releases the claim lease and the whole payout retries; both the points award and the grant are idempotent. `rankQualifiedPlayers` is exported from `pointsService.js` for this.

## 4. Shop behaviour

- `GET /api/shop`: only `acquisition: 'shop'` items whose window contains now.
- `POST /api/shop/purchase`: rejects earned items and out-of-window items with 404 `Item not found`.
- `POST /api/shop/seed`: the deactivation sweep and upsert only touch `acquisition: 'shop'` rows, so earned items are never deactivated. Catalog entries may carry `availableFrom` / `availableUntil`.
- Inventory and equip already work for owned items regardless of `isActive` and window; no change.
- `Shop.tsx`: earned items appear under an "Earned" group (source label, equip/unequip, no Buy) instead of "Owned (retired)".

## 5. Styling

- `FlairTier` gains `'prestige'`.
- `getTitleStyle` falls back to one `PRESTIGE_TITLE` style (`flair-title-prestige`, 🏆) when the value starts with a reserved prefix; no per-item registry entry.
- `.flair-title-prestige`: static gold-foil gradient badge with a subtle ring. No animation, so no reduced-motion rule is needed. Forced-colors and print fallbacks are added like other badges.
- `docs/flair-style-guide.md` gets a Prestige section (tier table row, prefix rule, never rename a shipped prefix).

## 6. Guard tests

- `server/src/data/shopCatalog.test.js`: no catalog `value` starts with a reserved prefix; `SHOP_CATALOG` contains no earned or `prestige` item; catalog entries with a window have `availableFrom` before `availableUntil`.
- `client/src/utils/__tests__/flairCatalog.test.ts`: values with each reserved prefix resolve to the prestige tier, the class is defined in `flair.css`, and it is listed in the forced-colors and print blocks.

## 7. Behaviour tests

Server (`flairGrantService.test.js`, `shop.test.js`, tournaments and rankedLeague tests):
- Grant twice for one event: one `ShopItem`, one `purchasedItems` entry, points unchanged.
- Concurrent grants for the same event converge on one item.
- Purchase of an earned item is rejected; purchase outside the window is rejected.
- `GET /api/shop` hides earned items and expired or not-yet-open items; an owner still sees an expired item in inventory and can equip it.
- Seed leaves earned items `isActive: true`.
- Tournament completion grants the winner, skips a dropped winner, and a repeat completion adds nothing.
- Season payout grants placement 1 including ties, skips unqualified players, and a simulated crash then retry yields exactly one grant each.

Client:
- `TitleBadge` renders the prestige style for prefixed values.
- `Shop.tsx` shows earned items under "Earned" with no Buy button.

## Out of scope

- Grants for placements below 1, and border/icon/name-color earned items.
- Any admin UI for creating limited-time items.
- Removing or revoking earned items.
