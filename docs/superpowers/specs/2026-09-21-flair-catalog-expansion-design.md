# Flair Catalog Expansion — Design Spec

**Date:** 2026-09-21
**Status:** Draft, pending review

## Goal

Add 33 new flair items to the shop (30 → 63), make the three tiers visibly different in **every** category (today name colors and name icons have no tier styling), halve every price, and clean up the render and seed code so the catalog is cheap to extend.

Titles and item names lean on puns and references: mahjong, anime, friendship, Japanese culture.

## Scope

In scope:

- 33 new items across `nameColor`, `nameIcon`, `profileBorder`, `title` (4 entry / 2 mid / 1+ premium per category; see Catalog).
- Tier styling for name colors and name icons, including restyling the existing mid and premium items in those categories.
- Fixing the premium border so only the ring spins, not the avatar.
- Halving all 63 prices (existing and new).
- Single-source catalog module shared by the seed script and the seed route.
- Folding in the equipped-state bug fix in `Shop.tsx` (see "Equipped-state fix").
- `prefers-reduced-motion` support for all flair animation.
- Updating `docs/flair-style-guide.md`.

Out of scope: achievement-gated or seasonal items, bundles, new flair categories, refunds for anyone who already bought at the old prices, changes to private-mode behavior, changes to how points are earned.

## Style guidelines (settled)

| Category | Entry | Mid | Premium |
|---|---|---|---|
| **Name color** | Flat color | Static two-hue gradient text | Flowing multi-hue gradient text + three staggered ✦ sparkles overlapping the text corners |
| **Name icon** | Plain emoji | Soft static golden glow | Emoji-specific motion (e.g. flicker, sway) + colored glow |
| **Border** | Flat `box-shadow` ring | Static gradient wrapper | Spinning conic-gradient ring |
| **Title** | Pale-blue pill (existing `bg-primary-100`) | Shared silver badge | Unique gradient badge with emoji and glow |

Rules learned while designing:

- **Gradient text uses `background-image`, never the `background:` shorthand.** The shorthand resets `background-clip: text` and paints a solid box.
- **Mid-tier gradient end hues must be far enough apart to show on a ~10-character name.** Neighboring shades (emerald → teal, blue → cyan) read as flat.
- **Premium name colors need a palette that is clearly different from every other premium name color** (Crimson Dragon is red → slate, not red → gold, so it does not resemble Mahjong Gold).
- **Premium sparkles must not be reused for icons.** Premium icons use motion, so a player with a premium name and a premium icon does not get duplicated effects.

## Catalog

Prices are the halved values. The seed matches items by `name`, so names must be unique across all categories.

### Titles (`value` = the title text)

| Tier | Name | Cost | Description |
|---|---|---|---|
| entry | Nakama | 50 | Your crew, your comrades, your table |
| entry | Chi Chi | 50 | Calling a run, named after the Dragon Ball mom |
| entry | PonPonPon | 75 | Triplet call, Harajuku beat |
| entry | Kan I Help You? | 75 | A quad-calling customer service specialist |
| mid | Power of Friendship | 125 | The trope that wins every final arc |
| mid | Over 9000 Han | 175 | The scouter says this hand is worth more than 9000 han |
| premium | Tsumo-nami | 300 | A self-drawn win that hits like a wave. Badge: ocean gradient `#67e8f9 → #0ea5e9 → #1e3a8a`, white text, cyan glow, 🌊 prefix, class `flair-title-tsumonami` |

### Profile borders

| Tier | Name | Cost | `value` | Description |
|---|---|---|---|---|
| entry | Manzu | 50 | `flair-ring-manzu` (`#ef4444`) | The characters suit, in tile red |
| entry | Pinzu | 50 | `flair-ring-pinzu` (`#38bdf8`) | The circles suit, in dot blue |
| entry | Souzu | 75 | `flair-ring-souzu` (`#22c55e`) | The bamboo suit, in stalk green |
| entry | Persimmon | 75 | `flair-ring-persimmon` (`#fb923c`) | The orange of an autumn kaki |
| mid | Torii Ring | 125 | `flair-mid-torii` | Shrine-gate vermilion, deepening to burnt red. `linear-gradient(135deg, #ef4444, #dc2626, #fb923c, #991b1b, #ef4444)` |
| mid | Wisteria Ring | 150 | `flair-mid-wisteria` | Fuji blossoms, lavender to deep violet. `linear-gradient(135deg, #a78bfa, #7c3aed, #ddd6fe, #5b21b6, #a78bfa)` |
| premium | Hanabi | 300 | `flair-border-hanabi` | Fireworks circling in the night sky. `conic-gradient(#1e1b4b, #f472b6, #facc15, #1e1b4b, #38bdf8, #f472b6, #1e1b4b)`, 3s spin |
| premium | Kitsune Fire | 300 | `flair-border-kitsune` | Fox fire, spinning the other way. `conic-gradient(#f97316, #fde047, #ffffff, #fde047, #ef4444, #7f1d1d, #f97316)`, 2.6s reverse spin |
| premium | Yozakura | 300 | `flair-border-yozakura` | Night cherry blossoms in the dark. `conic-gradient(#f9a8d4, #a78bfa, #1e3a8a, #a78bfa, #f9a8d4, #ffffff, #f9a8d4)`, 4s spin |

### Name colors

| Tier | Name | Cost | `value` | Style |
|---|---|---|---|---|
| entry | Matcha | 50 | `flair-color-matcha` | `color: #65a30d` |
| entry | Aizome | 50 | `flair-color-aizome` | `color: #4f46e5` |
| entry | Umeboshi | 75 | `flair-color-umeboshi` | `color: #be123c` |
| entry | Sumi Ink | 75 | `flair-color-sumi` | `color: #334155` |
| mid | Fuji Sunset | 125 | `flair-color-fuji` | `linear-gradient(90deg, #f97316, #c026d3)` |
| mid | Moonlit Bamboo | 150 | `flair-color-moonlit` | `linear-gradient(90deg, #0d9488, #4f46e5)` |
| premium | Neon Akihabara | 300 | `flair-color-neon` | `linear-gradient(90deg, #0891b2, #22d3ee, #e879f9, #818cf8, #0891b2)`; sparkles `#a5f3fc`, glow `#06b6d4` / `#22d3ee` |
| premium | Tanabata Stars | 300 | `flair-color-tanabata` | `linear-gradient(90deg, #1e3a8a, #7c3aed, #a5b4fc, #7c3aed, #1e3a8a)`; sparkles `#e0e7ff`, glow `#6366f1` / `#818cf8` |

Descriptions: Matcha "Whisked green tea"; Aizome "Traditional indigo dye"; Umeboshi "Pickled sour plum"; Sumi Ink "Calligraphy ink, understated"; Fuji Sunset "The dusk sky behind the mountain"; Moonlit Bamboo "A bamboo grove under the moon"; Neon Akihabara "Electric-town lights, flowing"; Tanabata Stars "Midnight blue to starlight, twinkling".

Premium gradients flow with `background-size: 300% 100%` and a 4s linear infinite `background-position` animation.

### Name icons (`value` = the emoji)

| Tier | Name | Cost | Emoji | Description |
|---|---|---|---|---|
| entry | Onigiri | 50 | 🍙 | The rice ball that fuels every protagonist |
| entry | Dango | 50 | 🍡 | Sweet dumplings on a stick |
| entry | Hanafuda | 75 | 🎴 | Japanese flower cards |
| entry | Furin | 75 | 🎐 | A summer wind chime |
| mid | Torii Gate | 125 | ⛩️ | The entrance to a shrine |
| mid | Kitsune | 150 | 🦊 | The fox spirit and shrine messenger |
| premium | Firework | 300 | 🎆 | Bursts outward and pulses, glow shifting pink to gold |
| premium | Great Wave | 300 | 🌊 | Rolls and crests with a sea-blue glow |
| premium | Ninja | 300 | 🥷 | Blurs out, then reappears with a flash |

⛩️ is stored with its variation selector (U+FE0F). Registry lookups must match the exact stored string.

### Existing items

Values are unchanged (see Constraints). Costs are halved; styles change only where noted.

| Category | Item | Old → new cost | Style change |
|---|---|---|---|
| nameColor | Sakura Pink / Sea Teal / Amber | 100/100/150 → 50/50/75 | none |
| nameColor | Jade Green (`flair-color-emerald`) | 250 → 125 | gradient `#047857 → #65a30d` |
| nameColor | Ocean Blue (`flair-color-blue`) | 250 → 125 | gradient `#1e3a8a → #0891b2 → #14b8a6` |
| nameColor | Royal Purple (`flair-color-purple`) | 300 → 150 | gradient `#5b21b6 → #9333ea → #ec4899` |
| nameColor | Mahjong Gold (`flair-color-gold`) | 600 → 300 | flowing `#b45309, #f59e0b, #fde047, #f59e0b, #b45309`; gold sparkles (`#fde047`, glow `#f59e0b`) |
| nameColor | Crimson Dragon (`flair-color-red`) | 600 → 300 | flowing `#b91c1c, #ef4444, #64748b, #334155, #b91c1c`; sparkles `#fee2e2`, glow `#dc2626` / `#ef4444` |
| nameIcon | Red Lantern / Mahjong Tile / Lucky Star | 100/100/150 → 50/50/75 | none |
| nameIcon | Bamboo 🎋 / Crown 👑 / Dragon 🐉 | 200/250/300 → 100/125/150 | golden glow |
| nameIcon | Flame 🔥 | 500 → 250 | flicker + orange/amber glow |
| nameIcon | Cherry Blossom 🌸 | 600 → 300 | sway + pink glow |
| profileBorder | Blush / Pebble | 100 → 50 | none |
| profileBorder | Jade Ring / Cobalt Ring / Sakura Ring | 250/250/300 → 125/125/150 | none |
| profileBorder | Rainbow Halo / Dragon Scale | 600 → 300 | ring-only spin (see Borders) |
| title | Regular / Tenpai | 100/150 → 50/75 | none |
| title | East Wind / Dragon Slayer / Dora Hunter | 250/300/350 → 125/150/175 | none |
| title | Chicken Farmer / Chombo Chaser | 600 → 300 | none |

### Resulting catalog

26 entry (50–75), 20 mid (100–175), 17 premium (250–300). At about 6 points per game, entry items take roughly 8–12 games, mid 17–29, premium 42–50. A tournament win (200) now covers any mid item outright.

Items are ordered within each category entry → mid → premium (`sortOrder` renumbered).

## Constraints found in the code

1. **Equipped values are denormalized.** `POST /api/shop/equip` writes `item.value` into `User.equippedFlair.<slot>` (`server/src/routes/shop.js:109-111`). Renaming an existing item's `value` would orphan everyone who has it equipped, so existing values never change; restyling happens in CSS on the same class names.
2. **The client cannot see item tier at render time.** `UserDisplay` and `UserAvatar` only receive `equippedFlair` values. Tier-dependent rendering must be derived from the value alone.
3. **Premium borders currently spin the avatar.** The `flair-spin` animation is on the wrapper that contains the avatar image (`flair.css`, `UserAvatar.tsx`), and nothing counter-rotates. Not verified in a browser; this is what the CSS specifies.
4. **Gradient-clipped text blanks its children.** `UserDisplay` puts the name-color class on one element that also contains the icon and the "(You)" tag. `-webkit-text-fill-color: transparent` is inherited, so they would vanish.
5. **Two copies of `TitleBadge`.** `client/src/components/user/TitleBadge.tsx` and a private one at the bottom of `Shop.tsx`.
6. **Two copies of the catalog.** `server/scripts/seedShop.js` and `SEED_ITEMS` inside `server/src/routes/shop.js` (used by `POST /api/shop/seed`) disagree on values, tiers and prices (e.g. mid borders as `flair-ring-*`, Crown premium, Cherry Blossom entry, Mahjong Gold, Dragon Scale and Chombo Chaser at 700). An admin calling the route would revert the catalog as written.

## Architecture

### Style registry (`client/src/utils/flairUtils.ts`)

The `if (value === '…')` chains become lookup tables, the single client-side source of truth for flair identity strings:

- `TITLE_STYLES: Record<string, { tier, className?, emoji? }>`: keyed by title text.
- `ICON_STYLES: Record<string, { tier, className }>`: keyed by exact emoji string.
- `NAME_COLOR_STYLES: Record<string, { tier, sparkleClass? }>`: keyed by `flair-color-*` value.
- Borders keep prefix detection (`flair-ring-`, `flair-mid-`, `flair-border-`).

Existing exports (`isPremiumBorder`, `isMidTierBorder`, `getPremiumTitleClass`, `getPremiumTitleEmoji`, `getMidTierTitleClass`) remain as thin wrappers so current tests and call sites keep working. New helpers: `getTitleStyle`, `getIconClass`, `getNameColorStyle`, `isPremiumNameColor`.

### Components

- **`FlairName`** (`client/src/components/user/`): renders the display name. The color class goes on an inner span containing only the name text. Premium names get a relatively positioned wrapper plus three `aria-hidden` ✦ spans (`flair-sparkle-tr`, `-bl`, `-tm`) with the palette class from the registry. An optional `compact` prop omits the top-middle sparkle for small list text; the plan decides which call sites pass it. The icon and "(You)" tag render outside the gradient span. The surrounding `Link` keeps its own color and hover underline.
- **`FlairIcon`**: wraps the emoji in `<span class="flair-icon <class>" aria-hidden="true"><span class="e">…</span></span>` so filters and keyframes target the glyph.
- **`TitleBadge`** (shared): `Shop.tsx`'s private copy is deleted; the shared one is driven by `TITLE_STYLES` instead of its hard-coded `PREMIUM_TITLES` set.
- `UserDisplay.tsx`, the `Shop.tsx` preview box and the `Shop.tsx` item cards all use these components, so the shop preview matches what other players see. The card's name-color preview keeps the "Aa" sample text.

### CSS (`client/src/styles/flair.css`)

- **Premium borders:** one shared rule set for all five (`flair-border-rainbow`, `-dragon`, `-hanabi`, `-kitsune`, `-yozakura`): `position: relative; display: inline-flex; border-radius: 9999px; padding: 3px; overflow: hidden`, with a `::before` layer (`position: absolute; inset: 0; border-radius: inherit; background: var(--flair-conic); animation: flair-spin var(--flair-spin-duration) linear infinite`). Each class only sets `--flair-conic`, the duration and the direction. `.flair-border-inner` gets `position: relative; z-index: 1`. The selector list is explicit (not a `flair-border-*` attribute selector, which would also match `.flair-border-inner`).
- **Mid borders / entry rings:** unchanged structure; new classes only.
- **Name colors:** entry are `color:` declarations. Mid are `background-image` gradient + `background-clip: text` + `-webkit-text-fill-color: transparent`. Premium add `background-size: 300% 100%` and the flow animation. Sparkle overlays use `sp-twinkle` 2.4s with staggered delays (0 / .9s / 1.6s), sized in `em`.
- **Icons:** `flair-icon-glow` is `filter: drop-shadow(0 0 5px rgba(245,158,11,.75))`. Premium classes: `flair-icon-flame` (flicker 1.1s, orange/amber glow), `-blossom` (sway 2.6s, pink glow), `-firework` (burst pulse 1.4s, pink→gold glow with hue shift), `-wave` (roll 2.2s, sea-blue glow), `-ninja` (blur-out and reappear cycle 3.4s, indigo glow).
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` stops ring spins, gradient flow, icon animation and sparkle twinkle. Premium items keep their static look (sparkles rest at partial opacity).
- Dead `flair-ring-jade/cobalt/sakura` rules are removed once nothing references them.

## Server

- New `server/src/data/shopCatalog.js` exports the 63-item array. `server/scripts/seedShop.js` and the `POST /api/shop/seed` route both import it; the duplicate `SEED_ITEMS` in `shop.js` is deleted. Tiers and values follow the script (which matches the style guide).
- The seed's existing `$set: { cost, tier, description, value, sortOrder }` upsert applies the halved prices. Existing owners keep what they bought; no refunds or extra charges.
- Descriptions for new items are taken from the tables above.

## Equipped-state fix (folded in)

Tracked in `docs/tech-debt/flair/shop-equipped-state-compares-item-id-to-value.md` (state: New). `Shop.tsx` compares `equippedFlair[slot]` against `item._id`, but the server stores `item.value`, so "Equipped ✓" never renders and clicking an equipped item re-equips instead of unequipping (inferred from the code, not observed in a browser).

- `Shop.tsx` compares against `item.value`, through one small helper used by both `handleEquip` and the card render.
- Test fixtures that seed ids into `equippedFlair` (`Shop.test.tsx:137`, `shop.test.js:154/196/203`, `User.shopFlair.test.js:85`) are corrected to values, so the tests stop hiding the bug.
- Not included: switching storage to ids (rejected in the tech-debt plan: ripples through every avatar and name render and needs a data migration).
- Open hypothesis from that plan, to check against the database at rollout: users who equipped before the storage change may still hold ObjectId strings in their slots. If found, that is a separate cleanup.
- When implemented, the tech-debt plan moves to `docs/completed-tech-debt/flair/` following the repo convention.

## Testing

Jest + React Testing Library, queries by role/label (per `rules.md`).

- **Registry:** every new title, icon and name color resolves to the right tier and class; unknown values resolve to entry/no class; ⛩️ matches with its variation selector.
- **`FlairName`:** icon and "(You)" render outside the gradient span; premium names render exactly three `aria-hidden` sparkles (two when `compact`); entry and mid render none.
- **`UserAvatar`:** premium border wrapper keeps the avatar out of the animated layer (structure test); mid and entry unchanged.
- **`TitleBadge`:** entry, mid, premium (including Tsumo-nami's emoji) render correctly, and `Shop.tsx` uses the shared component.
- **Catalog integrity:** unique names; unique `value` per category; valid category and tier; costs inside each tier's band (entry 50–75, mid 100–175, premium 250–300); every entry in `shopCatalog.js` for `title`, `nameIcon` and premium/mid `nameColor` has a matching client registry entry (cross-package check; if CRA's Jest setup cannot import the server module, use a shared fixture list of values instead).
- **Shop:** equipped state renders and unequip fires the unequip request once fixtures use values; existing tests updated for new prices.
- **Not testable in jsdom:** animations and reduced-motion rules. Verified manually in the browser (see Rollout).
- Existing suites must still pass: `cd client && npm test -- --watchAll=false`, server tests, `prettier --check`.

## Documentation

`docs/flair-style-guide.md` is updated: tier table with halved price bands (entry 50–75, mid 100–175, premium 250–300), name-color and name-icon sections per the guidelines above, premium border ring structure, the `background-image` and gradient-distance rules, and the reduced-motion requirement. It also corrects the entry-title description (a pale-blue pill, not plain text).

## Rollout

1. Deploy the client first (new CSS and components). Items that do not exist yet render nothing new.
2. Then run `cd server && npm run seed:shop` (or the admin seed route). Seeding first would let players buy items whose classes are not deployed.
3. Verify in a browser: each new item in the shop preview and on a profile; premium borders leave the avatar still; premium names show sparkles and no clipped icon or "(You)"; reduced-motion setting stops animation.
4. Check the database for ObjectId strings in `equippedFlair` slots (see hypothesis above).

## Risks

- **Emoji rendering varies by platform.** ⛩️, 🥷 and 🎴 may look different or, on old systems, fall back to boxes. Glow and animation are applied to whatever glyph renders.
- **Animated `background-position` repaints.** Long lists with many premium names animate text gradients; this is acceptable at club scale, but the reduced-motion rules are the escape hatch.
- **Price change is visible.** Every price halves, so the points-economy assumption recorded in `docs/completed-tech-debt/games/points-economy-amounts-and-award-triggers.md` (200 for first place "buys the cheapest mid item") no longer holds; 200 now covers any mid item.
