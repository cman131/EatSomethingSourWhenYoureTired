# Flair Shop Initial Catalog Design

**Date:** 2026-09-20  
**Status:** Approved

## Goals

Define the full initial item catalog for the Flair Shop — 30 items across 4 categories — so the store feels populated and purposeful at launch. This spec covers item names, descriptions, `value` fields (what gets stored and rendered), costs, and rendering tier notes for premium items that require custom CSS beyond plain Tailwind ring classes.

This spec does **not** cover achievement-gated items (deferred) or new flair categories (deferred). All 30 items are purchasable with points by any player.

## Pricing Tiers

| Tier | Price range | Rationale |
|---|---|---|
| Entry | 100–150 pts | Achievable in 1–3 weeks of regular play. Every player can own a few quickly. |
| Mid | 200–350 pts | ~1–2 months of active play. Meaningful but not aspirational. |
| Premium | 500–700 pts | 3–5 months of active play. Aspirational; visually distinctive from common items. |

Points economy reference: playing a game earns 5 pts; submitting earns 10 pts; verifying earns 5 pts; tournament participation 15 pts; tournament placement 10–40 pts.

## Catalog

### Name Colors (`nameColor`)

`value` is a Tailwind text-color class applied to the player's display name everywhere it renders.

| Name | `value` | Description | Cost | Tier |
|---|---|---|---|---|
| Sakura Pink | `text-pink-500` | Delicate cherry blossom pink | 100 | entry |
| Sea Teal | `text-teal-600` | Inspired by the East China Sea | 100 | entry |
| Amber | `text-amber-600` | Warm amber glow | 150 | entry |
| Jade Green | `text-emerald-600` | Classic jade green | 250 | mid |
| Ocean Blue | `text-blue-600` | A deep ocean blue | 250 | mid |
| Royal Purple | `text-purple-600` | Regal and commanding | 300 | mid |
| Crimson Dragon | `text-red-600` | The fierce red of a dragon | 600 | premium |
| Mahjong Gold | `text-yellow-600` | The golden color of a winning hand | 700 | premium |

All 8 items use standard Tailwind classes — no special rendering needed.

---

### Name Icons (`nameIcon`)

`value` is an emoji character rendered immediately before the player's display name.

| Name | `value` | Description | Cost | Tier |
|---|---|---|---|---|
| Cherry Blossom | 🌸 | A delicate sakura bloom | 100 | entry |
| Bamboo | 🎋 | A lucky bamboo stalk | 100 | entry |
| Lucky Star | ⭐ | For lucky players | 150 | entry |
| Red Lantern | 🏮 | A traditional festival lantern | 200 | mid |
| Mahjong Tile | 🀄 | The iconic mahjong tile | 250 | mid |
| Dragon | 🐉 | A fearsome dragon | 300 | mid |
| Flame | 🔥 | You are on fire | 500 | premium |
| Crown | 👑 | Royalty at the table | 600 | premium |

All 8 items render as emoji — no special rendering needed.

---

### Profile Borders (`profileBorder`)

Entry and mid items use Tailwind `ring-*` classes applied directly to the avatar element. Premium items use **custom CSS class names** that require a dedicated stylesheet and a wrapper-div rendering approach (see Rendering Notes below).

| Name | `value` | Description | Cost | Tier |
|---|---|---|---|---|
| Blush | `ring-2 ring-pink-300` | A soft pink ring | 100 | entry |
| Pebble | `ring-2 ring-gray-400` | A simple stone-grey ring | 100 | entry |
| Jade Ring | `ring-2 ring-emerald-500` | Rich jade border | 250 | mid |
| Cobalt Ring | `ring-2 ring-blue-500` | Deep cobalt border | 250 | mid |
| Sakura Ring | `ring-2 ring-pink-400` | Cherry blossom pink border | 300 | mid |
| Rainbow Halo | `flair-border-rainbow` | Slowly spinning rainbow conic gradient | 600 | premium |
| Dragon Scale | `flair-border-dragon` | Spinning emerald conic gradient — shimmering scales | 700 | premium |

**Rainbow Halo CSS:** spinning conic gradient (`conic-gradient(#facc15, #fb923c, #f87171, #e879f9, #818cf8, #34d399, #facc15)`) with a 3-second rotation animation, inset white gap ring to float it away from the avatar.

**Dragon Scale CSS:** reverse-spinning emerald conic gradient (`conic-gradient(#34d399, #059669, #065f46, #059669, #34d399, #6ee7b7, #34d399)`) with a 4-second rotation, same inset gap approach.

---

### Titles (`title`)

Entry and mid items are plain text rendered as a standard `bg-primary-100 text-primary-800` pill badge. Premium items use **custom badge styles** (see Rendering Notes).

| Name | `value` | Description | Cost | Tier |
|---|---|---|---|---|
| Regular | `Regular` | A familiar face at the table | 100 | entry |
| Tenpai | `Tenpai` | Always one tile away from winning | 150 | entry |
| East Wind | `East Wind` | The dealer's seat — a position of prestige | 250 | mid |
| Dragon Slayer | `Dragon Slayer` | Defeated more than a few big hands | 300 | mid |
| Dora Hunter | `Dora Hunter` | Always chasing bonus tiles | 350 | mid |
| Chicken Farmer | `Chicken Farmer` | Wins without a single yaku. Honkaku's nemesis. | 600 | premium |
| Chombo Chaser | `Chombo Chaser` | A dedicated student of the penalty sheet. | 700 | premium |

**Chicken Farmer badge:** gold gradient (`linear-gradient(135deg, #fef08a, #fde68a, #fbbf24)`) with amber border, brown text, subtle shadow. Emoji prefix: 🐔.

**Chombo Chaser badge:** red→purple gradient (`linear-gradient(135deg, #f87171, #e879f9, #c026d3)`) with pink-purple border, white text, glow shadow. Emoji prefix: ⚡.

---

## Rendering Notes

### Standard items (entry + mid)
No rendering changes needed beyond what the current `UserDisplay`, `UserAvatar`, and `Shop.tsx` already support. These items work once the existing flair rendering gaps are fixed (see `docs/tech-debt/flair/flair-cosmetics-not-rendering.md`).

### Premium borders
Current `UserAvatar` applies `value` as a Tailwind class directly on the avatar `div`. Animated conic-gradient borders require a **wrapper div** approach:

```tsx
// instead of: <div className={`rounded-full ${borderClass}`} />
// premium: wrap avatar in a spinning gradient div
<div className="flair-border-wrapper flair-border-rainbow">
  <div className="flair-border-inner">
    {/* avatar content */}
  </div>
</div>
```

The `value` field stores the custom class name (e.g., `flair-border-rainbow`). The rendering component switches on `tier === 'premium'` to choose the wrapper-div path vs the ring-class path. CSS lives in a new `client/src/styles/flair.css` imported from the app root.

### Premium titles
Current rendering applies the same `bg-primary-100 text-primary-800` pill style to all titles. Premium titles need an override — the rendering component checks whether the item's `value` matches a known premium title (or the ShopItem model gains a `tier` field), and applies the appropriate gradient badge CSS class instead.

**Implementation approach:** add a `tier` field (`'entry' | 'mid' | 'premium'`, default `'entry'`) to the `ShopItem` model and include it in all API responses. The title badge renderer and border renderer both switch on `tier` — this is cleaner than inspecting `value` strings and makes future premium items trivially easy to add. The existing `previewCss` field on `ShopItem` (currently unused) can carry the gradient inline style string for shop card previews of premium items, so the card can render a visual swatch without needing to import the flair stylesheet.

## Existing Seed Data

The 18 items in `SEED_ITEMS` in `server/src/routes/shop.js` overlap with this catalog (Jade Green, Crimson, Royal Purple, Ocean Blue, Mahjong Gold, Dragon, Cherry Blossom, Mahjong Tile, Lucky Star, Bamboo, Flame, Gold Ring, Dragon Scale, Sakura border, Newcomer, Dragon title, Champion, Riichi Master).

The implementation plan should **replace** `SEED_ITEMS` wholesale with the 30 items defined here. Items from the old seed that don't appear in this catalog (Newcomer, Dragon title, Champion, Riichi Master) are dropped — they were placeholders. Pricing on retained items is updated to match the tier structure above.

## Out of Scope

- Achievement-gated items (deferred — no stat threshold gating in this pass)
- New flair categories beyond the existing 4
- Seasonal / limited-time items
- Item bundles or discounts
