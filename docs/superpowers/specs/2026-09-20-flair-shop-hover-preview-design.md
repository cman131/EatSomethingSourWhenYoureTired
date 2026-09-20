# Flair Shop Hover Preview Fix

**Date:** 2026-09-20  
**Scope:** `client/src/pages/Shop.tsx` only — no backend changes, no new files

## Problem

Hovering a flair item in the shop should apply that item's style to the live preview at the top of the page, while all other equipped slots continue to show the user's actual equipped flair. Currently:

- **Name Effects (nameColor):** hover has no visible effect — the flair color class is overridden by Tailwind's `text-gray-900` utility (which loads after `flair.css`, winning the cascade at equal specificity).
- **Borders (profileBorder):** hover has no visible effect — the `previewUser` construction only handles `nameColor` and `nameIcon` in its ternary; all other categories fall through to the currently equipped value.
- **Titles:** only appear in the preview while hovering a title item; an equipped title disappears from the preview when hovering any other tab.

Icons (nameIcon) work correctly.

## Design

### Change 1 — Simplify `previewUser` construction

**File:** `Shop.tsx` lines 81–94

Replace the per-category ternary with a single expression. The `...equippedFlair` spread already provides all equipped slots as a base; the override just needs to inject the hovered item's value into its own slot.

```tsx
equippedFlair: hoveredItem
  ? { ...equippedFlair, [hoveredItem.category]: hoveredItem.value }
  : equippedFlair,
```

### Change 2 — Fix CSS cascade on preview name span

**File:** `Shop.tsx` line 154

Remove the static `text-gray-900` when a flair color is active. Both classes have single-class specificity, and Tailwind utilities load after `flair.css` in `index.css`, so `text-gray-900` wins. Apply it as a fallback only:

```tsx
<span className={`font-medium ${previewNameColor || 'text-gray-900'}`}>
```

### Change 3 — Show equipped title at all times in preview

**File:** `Shop.tsx` lines 101, 158–160

Replace the `hoveredTitle` variable (which was only truthy when hovering a title item) with a catalog lookup on `previewUser.equippedFlair.title`. The catalog's `title` array has `value` and `tier` for every title item, so the tier needed by `TitleBadge` is always available.

```tsx
const previewTitleValue = previewUser.equippedFlair.title;
const previewTitleItem = previewTitleValue
  ? (catalog?.title ?? []).find(i => i.value === previewTitleValue) ?? null
  : null;
```

In the JSX, replace `hoveredTitle` with `previewTitleItem`.

## Behavior After Fix

| Hovered category | nameColor slot | nameIcon slot | profileBorder slot | title slot |
|---|---|---|---|---|
| None | equipped | equipped | equipped | equipped |
| nameColor | **hovered** | equipped | equipped | equipped |
| nameIcon | equipped | **hovered** | equipped | equipped |
| profileBorder | equipped | equipped | **hovered** | equipped |
| title | equipped | equipped | equipped | **hovered** |

## Out of Scope

- The `equippedFlair[item.category] === item._id` equipped-check bug (line 188) — a separate issue affecting Equip/Equipped button state, not the hover preview.
- Backend schema changes.
- Any other flair-rendering components.
