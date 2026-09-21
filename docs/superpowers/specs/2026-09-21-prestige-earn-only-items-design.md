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
| Tournament title text | New optional `winnerTitle` on `Tournament`, max 30 characters. The create/edit form auto-populates it with the truncated tournament name; the creator can change it. |
| How does the client recognize a prestige title? | The server prepends the reserved marker `🏆 ` to every earned title value; `getTitleStyle` matches on it. |
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

`server/src/models/Tournament.js`
- `winnerTitle`: optional `String`, `trim: true`, `maxlength: [30, ...]`. Single constant `WINNER_TITLE_MAX_LENGTH = 30` in `server/src/utils/winnerTitle.js`.

## 2. Winner title text

`server/src/utils/winnerTitle.js` exports:
- `WINNER_TITLE_MAX_LENGTH` (30).
- `defaultWinnerTitle(name)`: `name.trim().slice(0, 30).trimEnd()`.
- `resolveWinnerTitle(tournament)`: `tournament.winnerTitle` if non-blank, otherwise `defaultWinnerTitle(tournament.name)`. This covers tournaments created before the field existed and API callers that omit it.

Client (`TournamentSubmission.tsx`, create and edit): the Winner title input starts as `defaultWinnerTitle(name)` and keeps following the name while it still equals the default for the previous name. Once the creator types their own value it stops following. A `maxLength={30}` attribute and helper text ("Shown on the winner's badge") guard the input. The client reads the limit from a mirrored constant; a parity test reads the server constant, the same way `flairCatalog.test.ts` reads the server catalog.

`winnerTitle` is editable through `PUT /:id` (already limited to the owner or an admin) until the tournament is `Completed`, then locked so the grant reads a settled value. Validation lives at the route boundary; the model `maxlength` is the backstop.

## 3. Grant service

New `server/src/utils/flairGrantService.js` (separate from `shopService.js`, which handles purchasing).

`grantEarnedTitle(userId, { kind, refId, label })`:
1. Upsert the `ShopItem` by `sourceKey = "<kind>:<refId>"` with `acquisition: 'earned'`, `category: 'title'`, `tier: 'prestige'`, `cost: 0`. `value` and `name` are `"🏆 " + label`. `sourceKey` is unique, so concurrent callers converge on one row.
2. `User.findOneAndUpdate({ _id, 'purchasedItems.item': { $ne: item._id } }, { $push: { purchasedItems: { item: item._id, source } } })`. This matches the guard used by `purchaseItem`.
3. Never touches `pointsBalance` or the ledger.

Labels:
- Tournament: `resolveWinnerTitle(tournament)`.
- Season: `Season Champion: <Mon YYYY>` from the league `startDate` (leagues have no season number).

Two events can yield identical values (same-named tournaments). Dedupe is by `sourceKey`, so both are granted; both then render as equipped when either is. This is accepted.

Organizer-entered text appears next to the winner's name. React escapes it and creators are club members, so no moderation is added.

## 4. Triggers

Tournament (`server/src/routes/tournaments.js`, after `awardTournamentPoints`): grant `top4[0]` unless that player dropped, in its own try/catch that logs and swallows errors, as the points call does.

Season (`server/src/utils/rankedLeagueService.js`, `payEndedSeason`): after `awardRankedSeasonPlacementPoints(claimedLeague)` and inside the same `try`, grant every placement-1 player. A failure releases the claim lease and the whole payout retries; both the points award and the grant are idempotent. `rankQualifiedPlayers` is exported from `pointsService.js` for this.

## 5. Shop behaviour

- `GET /api/shop`: only `acquisition: 'shop'` items whose window contains now.
- `POST /api/shop/purchase`: rejects earned items and out-of-window items with 404 `Item not found`.
- `POST /api/shop/seed`: the deactivation sweep and upsert only touch `acquisition: 'shop'` rows, so earned items are never deactivated. Catalog entries may carry `availableFrom` / `availableUntil`.
- Inventory and equip already work for owned items regardless of `isActive` and window; no change.
- `Shop.tsx`: earned items appear under an "Earned" group (source label, equip/unequip, no Buy) instead of "Owned (retired)".

## 6. Styling

- `FlairTier` gains `'prestige'`.
- `getTitleStyle` falls back to one `PRESTIGE_TITLE` style (`flair-title-prestige`) when the value starts with `🏆 `; no per-item registry entry. The marker is part of the stored value, so the style needs no separate emoji.
- `.flair-title-prestige`: static gold-foil gradient badge with a subtle ring. No animation, so no reduced-motion rule is needed. Forced-colors and print fallbacks are added like other badges.
- `docs/flair-style-guide.md` gets a Prestige section (tier table row, marker rule, never change the shipped marker).

## 7. Guard tests

- `server/src/data/shopCatalog.test.js`: no catalog `value` starts with `🏆 `; `SHOP_CATALOG` contains no earned or `prestige` item; catalog entries with a window have `availableFrom` before `availableUntil`.
- `client/src/utils/__tests__/flairCatalog.test.ts`: values starting with `🏆 ` resolve to the prestige tier, the class is defined in `flair.css`, and it is listed in the forced-colors and print blocks; the client winner-title limit equals the server constant.

## 8. Behaviour tests

Server (`flairGrantService.test.js`, `winnerTitle.test.js`, `shop.test.js`, tournaments and rankedLeague tests):
- Grant twice for one event: one `ShopItem`, one `purchasedItems` entry, points unchanged.
- Concurrent grants for the same event converge on one item.
- `resolveWinnerTitle` uses `winnerTitle` when set and the truncated name when blank or missing; `defaultWinnerTitle` never exceeds 30 characters or leaves trailing whitespace.
- `PUT /:id` rejects `winnerTitle` over 30 characters and rejects changes once the tournament is `Completed`.
- Purchase of an earned item is rejected; purchase outside the window is rejected.
- `GET /api/shop` hides earned items and expired or not-yet-open items; an owner still sees an expired item in inventory and can equip it.
- Seed leaves earned items `isActive: true`.
- Tournament completion grants the winner, skips a dropped winner, and a repeat completion adds nothing.
- Season payout grants placement 1 including ties, skips unqualified players, and a simulated crash then retry yields exactly one grant each.

Client:
- `TournamentSubmission` auto-fills the title from the name, keeps following name edits until the creator edits the title, then stops.
- `TitleBadge` renders the prestige style for `🏆 `-prefixed values.
- `Shop.tsx` shows earned items under "Earned" with no Buy button.

## Out of scope

- Grants for placements below 1, and border/icon/name-color earned items.
- Any admin UI for creating limited-time items.
- Removing or revoking earned items.
- Moderation of organizer-entered title text.
