# Mid-Tier Flair Visual Enhancement — Design Spec

**Date:** 2026-09-21
**Status:** Approved

## Goal

Make mid-tier shop items visually more interesting than entry tier without reaching the animated intensity of premium tier. Specifically: profile borders and title badges for the three mid-tier options in each category.

## Scope

- `client/src/styles/flair.css` — add mid-tier CSS classes
- `client/src/utils/flairUtils.ts` — add `isMidTierBorder()` and `getMidTierTitleClass()`
- `server/scripts/seedShop.js` — update mid-tier border values
- The avatar component that renders border wrappers — update to check for mid-tier borders

Not in scope: name colors (`flair-color-*`), entry-tier items, premium-tier items, nameIcon items.

---

## Profile Borders

### Approach: Static gradient wrapper

Mid-tier borders use the same wrapper element approach as premium (`flair-border-*`) but with a **static** multi-stop linear gradient — no animation. This distinguishes them from:
- Entry tier: plain 2px `box-shadow` ring
- Premium tier: animated spinning conic-gradient

### New CSS class prefix: `flair-mid-`

```css
.flair-mid-jade {
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
  background: linear-gradient(135deg, #10b981, #059669, #34d399, #065f46, #10b981);
}
.flair-mid-cobalt {
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8, #93c5fd, #1e40af, #3b82f6);
}
.flair-mid-sakura {
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
  background: linear-gradient(135deg, #f472b6, #ec4899, #fbcfe8, #be185d, #f472b6);
}
```

The existing `.flair-border-inner` class (already defined) handles the inner avatar rounding — no new inner class needed.

### `seedShop.js` value changes

| Item | Before | After |
|------|--------|-------|
| Jade Ring | `flair-ring-jade` | `flair-mid-jade` |
| Cobalt Ring | `flair-ring-cobalt` | `flair-mid-cobalt` |
| Sakura Ring | `flair-ring-sakura` | `flair-mid-sakura` |

### `flairUtils.ts` addition

```ts
export function isMidTierBorder(borderValue: string): boolean {
  return borderValue.startsWith('flair-mid-');
}
```

The avatar render component checks `isPremiumBorder(value) || isMidTierBorder(value)` to decide whether to render the gradient wrapper. Both tiers use the same wrapper HTML structure.

---

## Title Badges

### Approach: Unified silver metallic gradient

All three mid-tier titles share a single CSS class — a silver/steel gradient that reads as a "mid-tier" identity rather than per-title flavour. This is intentionally less vivid than the premium titles (which have per-title thematic gradients and glows).

```css
.flair-title-mid {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1, #94a3b8, #64748b);
  color: #0f172a;
  border: 1px solid #94a3b8;
}
```

### `flairUtils.ts` addition

```ts
export function getMidTierTitleClass(titleValue: string): string {
  if (titleValue === 'East Wind') return 'flair-title-mid';
  if (titleValue === 'Dragon Slayer') return 'flair-title-mid';
  if (titleValue === 'Dora Hunter') return 'flair-title-mid';
  return '';
}
```

The title badge component calls `getMidTierTitleClass()` in addition to (and falling back from) `getPremiumTitleClass()`.

---

## Visual Hierarchy Summary

| Tier | Profile Border | Title Badge |
|------|---------------|-------------|
| Entry | Plain `box-shadow` ring, solid color | No special styling |
| Mid | Static multi-stop linear gradient wrapper | Shared silver metallic gradient |
| Premium | Animated spinning conic-gradient wrapper | Per-title thematic gradient with glow |
