# Flair Shop Hover Preview Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the flair shop hover preview so all four flair categories (nameColor, nameIcon, profileBorder, title) apply correctly when hovering an item, while all other equipped slots remain visible.

**Architecture:** Three targeted bug fixes in `Shop.tsx`: (1) collapse the per-category ternary in `previewUser` so all categories use `hoveredItem.value`; (2) make `text-gray-900` a fallback on the preview name span so flair color classes aren't overridden by Tailwind; (3) replace the `hoveredTitle` variable with a catalog lookup so an equipped title shows in the preview at all times.

**Tech Stack:** TypeScript, React 18, Jest + React Testing Library

---

## File Map

| File | Change |
|------|--------|
| `client/src/pages/__tests__/Shop.test.tsx` | Add hover preview tests for border, nameColor, and title |
| `client/src/pages/Shop.tsx` | Fix three bugs in preview logic |

---

### Task 1: Fix border hover preview

**Files:**
- Modify: `client/src/pages/__tests__/Shop.test.tsx`
- Modify: `client/src/pages/Shop.tsx` (lines 81–94)

- [ ] **Step 1: Add `within` to the RTL import**

In `client/src/pages/__tests__/Shop.test.tsx`, update line 3:

```tsx
import { render, screen, fireEvent, within } from '@testing-library/react';
```

- [ ] **Step 2: Write the failing test**

Add a new `describe` block **inside** the existing `describe('Shop page', ...)` block, just before its closing `}`:

```tsx
  describe('hover preview', () => {
    test('hovering a profileBorder item applies its class to the preview avatar', () => {
      const catalogWithBorder = {
        ...mockCatalog,
        profileBorder: [
          {
            _id: 'border1',
            name: 'Jade Ring',
            description: 'A jade ring',
            category: 'profileBorder' as const,
            cost: 200,
            value: 'flair-ring-jade',
            tier: 'entry' as const,
            sortOrder: 1,
            isActive: true,
          } as ShopItem,
        ],
      };
      mockShopUseApi(catalogWithBorder);
      render(<Shop />);

      fireEvent.click(screen.getByRole('button', { name: /borders/i }));

      // Before hover — preview avatar has no border class
      const nameSpan = screen.getByText('Your Name');
      const avatarDiv = nameSpan.previousElementSibling as HTMLElement;
      expect(avatarDiv).not.toHaveClass('flair-ring-jade');

      // Fire hover
      const itemCard = screen.getByText('Jade Ring').closest('div.bg-white') as HTMLElement;
      fireEvent.mouseEnter(itemCard);

      // After hover — preview avatar has the border class
      expect(avatarDiv).toHaveClass('flair-ring-jade');
    });
  });
```

**Why `previousElementSibling` works:** The preview flex container is `[avatar div][name span][optional title badge]`. `screen.getByText('Your Name')` returns the name span; its `previousElementSibling` is the avatar div.

- [ ] **Step 3: Run the test and confirm it fails**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="Shop.test"
```

Expected output contains:
```
● hover preview › hovering a profileBorder item applies its class to the preview avatar
  expect(element).toHaveClass("flair-ring-jade")
```

- [ ] **Step 4: Simplify `previewUser` construction**

In `client/src/pages/Shop.tsx`, replace lines 81–94:

```tsx
  const previewUser = {
    _id: 'preview',
    displayName: 'Your Name',
    equippedFlair: hoveredItem
      ? {
          ...equippedFlair,
          [hoveredItem.category]: hoveredItem.category === 'nameColor'
            ? hoveredItem.value
            : hoveredItem.category === 'nameIcon'
            ? hoveredItem.value
            : equippedFlair[hoveredItem.category],
        }
      : equippedFlair,
  };
```

with:

```tsx
  const previewUser = {
    _id: 'preview',
    displayName: 'Your Name',
    equippedFlair: hoveredItem
      ? { ...equippedFlair, [hoveredItem.category]: hoveredItem.value }
      : equippedFlair,
  };
```

- [ ] **Step 5: Run tests and confirm they pass**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="Shop.test"
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/__tests__/Shop.test.tsx client/src/pages/Shop.tsx
git commit -m "fix: apply hovered item value for all flair categories in shop preview"
```

---

### Task 2: Fix nameColor hover preview

**Files:**
- Modify: `client/src/pages/__tests__/Shop.test.tsx`
- Modify: `client/src/pages/Shop.tsx` (preview name span)

**Background:** `equippedFlair.nameColor` already contains `hoveredItem.value` after Task 1. The bug is that the preview span has `text-gray-900` hardcoded alongside the flair color class. Since Tailwind utilities load *after* `flair.css` in `index.css`, `text-gray-900` wins the CSS cascade at equal specificity, hiding the flair color in production.

- [ ] **Step 1: Write the failing test**

Add this test **inside** the existing `describe('hover preview', ...)` block from Task 1 (before its closing `}`):

```tsx
    test('hovering a nameColor item applies the color class and removes text-gray-900 from the preview name', () => {
      mockShopUseApi(); // default catalog: nameColor[0] has value 'text-emerald-600'
      render(<Shop />);

      // Before hover — span has the fallback text-gray-900
      const nameSpan = screen.getByText('Your Name');
      expect(nameSpan).toHaveClass('text-gray-900');

      // Fire hover on 'Jade Green' (value: 'text-emerald-600')
      const itemCard = screen.getByText('Jade Green').closest('div.bg-white') as HTMLElement;
      fireEvent.mouseEnter(itemCard);

      // After hover — color class applied, text-gray-900 removed
      expect(nameSpan).toHaveClass('text-emerald-600');
      expect(nameSpan).not.toHaveClass('text-gray-900');
    });
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="Shop.test"
```

Expected output contains:
```
● hover preview › hovering a nameColor item applies the color class ...
  expect(element).not.toHaveClass("text-gray-900")
```

- [ ] **Step 3: Fix the preview name span**

In `client/src/pages/Shop.tsx`, find:

```tsx
          <span className={`font-medium text-gray-900 ${previewNameColor}`}>
```

Replace with:

```tsx
          <span className={`font-medium ${previewNameColor || 'text-gray-900'}`}>
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="Shop.test"
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/__tests__/Shop.test.tsx client/src/pages/Shop.tsx
git commit -m "fix: use flair color class as exclusive alternative to text-gray-900 in shop preview"
```

---

### Task 3: Fix title preview

**Files:**
- Modify: `client/src/pages/__tests__/Shop.test.tsx`
- Modify: `client/src/pages/Shop.tsx` (hoveredTitle variable and JSX)

**Background:** The current code only shows a title badge in the preview while hovering a title item (`hoveredTitle = hoveredItem?.category === 'title' ? hoveredItem : null`). An equipped title disappears from the preview when hovering any other category. The fix replaces `hoveredTitle` with a lookup on `previewUser.equippedFlair.title` against the catalog, so the title is derived from state (hovered or equipped) at all times.

`getPremiumTitleClass('Chicken Farmer')` returns `'flair-title-chicken'` and `getPremiumTitleClass('Chombo Chaser')` returns `'flair-title-chombo'`. The tests use these CSS classes to confirm the title badge renders rather than matching text content (which varies by emoji prefix).

- [ ] **Step 1: Write the failing tests**

Add these two tests **inside** the `describe('hover preview', ...)` block:

```tsx
    test('shows equipped title in preview without hovering a title item', () => {
      const catalogWithTitle = {
        ...mockCatalog,
        title: [
          {
            _id: 'title1',
            name: 'Chicken Farmer',
            description: 'A special title',
            category: 'title' as const,
            cost: 500,
            value: 'Chicken Farmer',
            tier: 'premium' as const,
            sortOrder: 1,
            isActive: true,
          } as ShopItem,
        ],
      };
      mockShopUseApi(catalogWithTitle, {
        ...mockInventory,
        equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: 'Chicken Farmer' },
      });
      render(<Shop />);

      // Default tab is nameColor — no title items visible in grid
      // The equipped title should still appear in the preview box
      const previewBox = screen.getByText('Preview').parentElement as HTMLElement;
      expect(previewBox.querySelector('.flair-title-chicken')).toBeInTheDocument();
    });

    test('hovering a title item shows that title in the preview', () => {
      const catalogWithTitle = {
        ...mockCatalog,
        title: [
          {
            _id: 'title2',
            name: 'Chombo Chaser',
            description: 'A chaos title',
            category: 'title' as const,
            cost: 500,
            value: 'Chombo Chaser',
            tier: 'premium' as const,
            sortOrder: 2,
            isActive: true,
          } as ShopItem,
        ],
      };
      mockShopUseApi(catalogWithTitle);
      render(<Shop />);

      fireEvent.click(screen.getByRole('button', { name: /titles/i }));

      const previewBox = screen.getByText('Preview').parentElement as HTMLElement;
      expect(previewBox.querySelector('.flair-title-chombo')).not.toBeInTheDocument();

      // 'Chombo Chaser' appears as the item name in the card (exact text, no emoji)
      const itemCard = screen.getByText('Chombo Chaser').closest('div.bg-white') as HTMLElement;
      fireEvent.mouseEnter(itemCard);

      expect(previewBox.querySelector('.flair-title-chombo')).toBeInTheDocument();
    });
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="Shop.test"
```

Expected output contains two failures from the title tests.

- [ ] **Step 3: Replace `hoveredTitle` with catalog lookup**

In `client/src/pages/Shop.tsx`, find and remove:

```tsx
  const hoveredTitle = hoveredItem?.category === 'title' ? hoveredItem : null;
```

Add these two lines in its place (keep them in the same location, after the `previewUser` block):

```tsx
  const previewTitleValue = previewUser.equippedFlair.title;
  const previewTitleItem = previewTitleValue
    ? (catalog?.title ?? []).find(i => i.value === previewTitleValue) ?? null
    : null;
```

- [ ] **Step 4: Update the JSX title badge**

In `client/src/pages/Shop.tsx`, find:

```tsx
          {hoveredTitle && (
            <TitleBadge value={hoveredTitle.value} tier={hoveredTitle.tier} />
          )}
```

Replace with:

```tsx
          {previewTitleItem && (
            <TitleBadge value={previewTitleItem.value} tier={previewTitleItem.tier} />
          )}
```

- [ ] **Step 5: Run tests and confirm all pass**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="Shop.test"
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/__tests__/Shop.test.tsx client/src/pages/Shop.tsx
git commit -m "fix: show equipped title in shop preview at all times, not only while hovering"
```
