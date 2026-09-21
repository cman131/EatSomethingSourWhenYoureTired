# Flair Style Guide

Visual design philosophy for the shop cosmetics system. Catalog data lives in `server/src/data/shopCatalog.js`; the client registry is in `client/src/utils/flairUtils.ts`; all styles are in `client/src/styles/flair.css`.

## Tier Hierarchy

The shop has three tiers. Each tier is visibly distinct in **every** category, so players can tell at a glance how rare an item is.

| Tier | Feel | Animation | Cost range |
|------|------|-----------|------------|
| Entry | Flat, clean, simple | None | 50–75 pts |
| Mid | Richer, textured, gradient or glow | None | 100–175 pts |
| Premium | Bold, animated, striking | Yes | 250–300 pts |

| Category | Entry | Mid | Premium |
|---|---|---|---|
| Name color | Flat color | Static two-hue gradient text | Flowing multi-hue gradient text + three ✦ sparkles on the text corners |
| Name icon | Plain emoji | Soft static golden glow | Emoji-specific motion + colored glow |
| Border | Flat `box-shadow` ring | Static gradient wrapper | Spinning conic-gradient ring |
| Title | Pale-blue pill (`bg-primary-100`) | Shared silver badge | Unique gradient badge with emoji and glow |

## Hard rules

- **Never rename an existing item's `value`.** The server copies `value` onto `User.equippedFlair` when a player equips it, so a rename orphans everyone who has it equipped. Restyle in CSS under the same class name.
- **Gradient text uses `background-image`, never the `background:` shorthand.** The shorthand resets `background-clip: text` and paints a solid box.
- **Never nest an icon, a "(You)" tag or sparkles inside a gradient-clipped span.** Clipped text is transparent and it is inherited. `FlairName` puts the color class on a span holding only the name; everything else is a sibling.
- **Mid-tier gradient end hues must be far enough apart to show on a ~10-character name.** Emerald → teal and blue → cyan read as flat; emerald → lime and navy → cyan → sea green do not.
- **Premium name colors must not resemble each other.** Crimson Dragon is red → slate so it is distinct from Mahjong Gold.
- **Premium icons use motion, not sparkles.** Premium names already sparkle; a player with both should not get duplicate effects.
- **Every animation needs a `prefers-reduced-motion` fallback** (bottom of `flair.css`). Premium items keep their static look.
- **Item names are unique across the whole catalog** (the seed matches on `name`), and `sortOrder` lists entry, then mid, then premium within each category.
- **Never delete a flair class that a shipped item ever used.** `flair-ring-jade`, `flair-ring-cobalt` and `flair-ring-sakura` stay in `flair.css` (marked legacy) because users who equipped those items before they became `flair-mid-*` may still have those values stored.
- **Gradient text needs forced-colors and print fallbacks.** Windows forced-colors mode and print drop background images but leave the text fill transparent, which would make the name invisible. Every mid and premium name-color class is therefore also listed in the `@media (forced-colors: active)` and `@media print` blocks (`background-image: none; -webkit-text-fill-color: currentColor;`).
- **Do not place `FlairName` inside `truncate` or `overflow-hidden` ancestors.** The premium sparkles overhang the text box and would be clipped, and an inline-block wrapper cannot be ellipsized.
- **Premium name wrappers inherit `text-decoration`.** `.flair-sparkle-wrap` is inline-block, and inline-block boxes do not receive a parent link's hover underline, so the rule sets `text-decoration: inherit`. (Verified in Chrome: the hover underline renders under premium gradient names as a plain link-colored line.)

## Profile Borders

### Entry (`flair-ring-*`)
A plain `box-shadow` ring applied directly to the avatar. Single solid color. No wrapper.

### Mid (`flair-mid-*`)
A **static** 5-stop linear gradient on a wrapper element, light to dark within one color family.

### Premium (`flair-border-*`)
A spinning conic gradient on a wrapper. **Only the `::before` layer rotates**; the avatar (`.flair-border-inner`) sits above it and stays still. Each class sets `--flair-conic`, `--flair-spin-duration` and optionally `--flair-spin-direction: reverse`. The mid and premium wrapper rules set `isolation: isolate` so the avatar's `z-index: 1` does not leak into the page stacking order.

### Adding a border
- Entry: add a `flair-ring-*` class with a `box-shadow`.
- Mid: add a `flair-mid-*` class and add it to the shared selector list at the top of the mid section.
- Premium: add a `flair-border-*` class, add it to the shared selector lists (base and `::before`, and the reduced-motion block), and set the three custom properties. The catalog test fails if the class is missing from any of those lists.
- Prefix detection (`isPremiumBorder`, `isMidTierBorder`) is automatic.

## Name Colors (`flair-color-*`)

- **Entry:** a plain `color:` declaration.
- **Mid:** a two-hue `linear-gradient(90deg, …)` with the shared text-clip mechanics. Static.
- **Premium:** a multi-hue gradient with `background-size: 300% 100%` and the `flair-flow` animation, plus three `aria-hidden` ✦ sparkles (`flair-sparkle-tr`, `-bl`, `-tm`) from `FlairName`, colored by a `flair-sparkles-*` palette class. `compact` drops the top-middle sparkle.

### Adding a name color
1. Add the class in `flair.css`. Mid and premium classes also go in the shared text-clip selector list and in BOTH the `@media (forced-colors: active)` and `@media print` lists; premium classes also go in the flow-animation list and the reduced-motion list.
2. Add the value to `NAME_COLOR_STYLES` in `flairUtils.ts` (premium entries need a `sparkleClass`; add its `flair-sparkles-*` class to `flair.css`).
3. Add the item to `shopCatalog.js`. `flairCatalog.test.ts` fails if any of these is missing from the registry or from any hand-synced selector list in `flair.css`.

## Name Icons

Rendered by `FlairIcon`: `<span class="flair-icon …tier class" aria-hidden><span class="flair-icon-glyph">🔥</span></span>`. Filters and keyframes target `.flair-icon-glyph`.

- **Entry:** no class.
- **Mid:** `flair-icon-glow`, a soft static golden `drop-shadow`. Shared by every mid icon.
- **Premium:** one class per emoji (`flair-icon-flame`, `-blossom`, `-firework`, `-wave`, `-ninja`) with its own keyframes and glow.

Icon keys in `ICON_STYLES` must match the stored string exactly. The torii gate is `'⛩️'` (with its variation selector).

## Title Badges

Rendered by the shared `TitleBadge`, driven by `TITLE_STYLES`.

- **Entry:** pale-blue pill (`bg-primary-100 text-primary-800`). No registry class.
- **Mid:** all share `flair-title-mid`, a silver/steel gradient. Intentionally neutral.
- **Premium:** each gets its own `flair-title-<slug>` class, an emoji prefix and a glow.

| Title | Class | Character |
|-------|-------|-----------|
| Chicken Farmer | `flair-title-chicken` | Warm gold, amber text, 🐔 |
| Chombo Chaser | `flair-title-chombo` | Red → purple gradient, white text, pink glow, ⚡ |
| Tsumo-nami | `flair-title-tsumonami` | Ocean gradient, white text, cyan glow, 🌊 |

## CSS Architecture

### Prefix conventions

| Prefix | Tier | Render approach |
|--------|------|----------------|
| `flair-ring-*` | Entry | `box-shadow` direct on avatar |
| `flair-mid-*` | Mid | Static gradient wrapper element |
| `flair-border-*` | Premium | Wrapper with a spinning `::before` ring |
| `flair-color-*` | Any | Color class on the name span (`FlairName`) |
| `flair-sparkle*` | Premium | Sparkle overlays and palettes (`FlairName`) |
| `flair-icon-*` | Mid/Premium | Class on the icon wrapper (`FlairIcon`) |
| `flair-title-*` | Mid/Premium | Class on the title badge (`TitleBadge`) |

Never embed flair class names directly in component logic; go through `flairUtils.ts`.

### Guard tests

`client/src/utils/__tests__/flairCatalog.test.ts` reads the server catalog (`server/src/data/shopCatalog.js`), the client registry and `flair.css` and checks that every item is registered at its catalog tier and appears in every hand-synced selector list. `server/src/data/shopCatalog.test.js` checks catalog integrity (unique names, value uniqueness per category, price bands, ordering, unchanged legacy items).
