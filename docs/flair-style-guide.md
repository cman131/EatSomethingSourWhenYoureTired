# Flair Style Guide

Visual design philosophy for the shop cosmetics system.

## Tier Hierarchy

The shop has three tiers. Each tier is visually distinct — players should be able to tell at a glance how rare or premium an item is.

| Tier | Feel | Animation | Cost range |
|------|------|-----------|------------|
| Entry | Flat, clean, simple | None | 100–200 pts |
| Mid | Richer, textured, gradient | None | 250–350 pts |
| Premium | Bold, animated, striking | Yes | 500–600 pts |

---

## Profile Borders

### Entry tier
A plain `box-shadow` ring applied directly to the avatar element. Single solid color. No wrapper element.

```css
.flair-ring-blush { box-shadow: 0 0 0 2px #f9a8d4; }
```

### Mid tier (`flair-mid-*`)
A **static** multi-stop linear gradient using the wrapper element approach. No animation. The gradient should use 4–5 stops that range from light to dark within the item's color family — giving depth and shimmer without movement.

```css
.flair-mid-jade {
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
  background: linear-gradient(135deg, #10b981, #059669, #34d399, #065f46, #10b981);
}
```

### Premium tier (`flair-border-*`)
An **animated** conic-gradient using the same wrapper element. Spins continuously via `flair-spin` or `flair-spin-reverse`. Multi-color palettes that break from any single hue — rainbow, emerald, etc.

```css
.flair-border-rainbow {
  background: conic-gradient(#facc15, #fb923c, #f87171, #e879f9, #818cf8, #34d399, #facc15);
  animation: flair-spin 3s linear infinite;
}
```

### Adding a new border
- Entry: add a `flair-ring-*` class with a `box-shadow` value. No logic changes.
- Mid: add a `flair-mid-*` class with a static gradient. Add the item to `getMidTierTitleClass()` if it also has a title component. No logic changes — `isMidTierBorder()` auto-detects by prefix.
- Premium: add a `flair-border-*` class with an animated gradient. No logic changes — `isPremiumBorder()` auto-detects by prefix.

---

## Title Badges

Entry-tier titles have no special badge styling — they render as plain text.

### Mid tier — silver metallic
All mid-tier titles share a single `flair-title-mid` class. A silver/steel gradient that reads as a tier badge rather than per-title flavour. Intentionally neutral — the premium tier owns the colorful expressive territory.

### Premium tier — thematic, per-title
Each premium title gets its own class with a distinct color story and optional glow. Richer than mid-tier in both palette and shadow/box-shadow intensity.

| Title | Class | Character |
|-------|-------|-----------|
| Chicken Farmer | `flair-title-chicken` | Warm gold, amber text |
| Chombo Chaser | `flair-title-chombo` | Red → purple gradient, white text, pink glow |

### Adding a new title badge
- Mid: use `flair-title-mid` (shared). Add the title value to `getMidTierTitleClass()` in `flairUtils.ts`.
- Premium: create a new `flair-title-<slug>` class. Add it to `getPremiumTitleClass()` in `flairUtils.ts`.

---

## Name Colors (`flair-color-*`)

Plain CSS `color` declarations — no gradient, no background treatment at any tier. The visual hierarchy for name colors is expressed through the color's vibrancy and warmth alone, not through additional effects.

---

## CSS Architecture

All flair classes live in `client/src/styles/flair.css`. Detection logic (which items need a wrapper element, which get a badge class) lives in `client/src/utils/flairUtils.ts`. Never embed flair class names directly in component logic — always go through `flairUtils`.

### Key prefix conventions

| Prefix | Tier | Render approach |
|--------|------|----------------|
| `flair-ring-*` | Entry | `box-shadow` direct on avatar |
| `flair-mid-*` | Mid | Static gradient wrapper element |
| `flair-border-*` | Premium | Animated gradient wrapper element |
| `flair-color-*` | Any | CSS `color` on name text |
| `flair-title-*` | Mid/Premium | CSS class on title badge element |
