# Mid-Tier Flair Visual Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mid-tier shop profile borders and title badges visually richer than entry tier — using static gradient wrappers for borders and a shared silver metallic class for titles — without reaching the animated intensity of premium.

**Architecture:** Mid-tier borders use the same wrapper-element approach as premium but with a static `linear-gradient` and a new `flair-mid-*` CSS prefix. Detection is prefix-based via a new `isMidTierBorder()` utility. Mid-tier titles share a single `flair-title-mid` class, looked up via a new `getMidTierTitleClass()` utility.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Jest / React Testing Library

---

### Task 1: Write failing unit tests for new flairUtils functions

**Files:**
- Create: `client/src/utils/__tests__/flairUtils.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { isMidTierBorder, getMidTierTitleClass } from '../flairUtils';

describe('isMidTierBorder', () => {
  test('returns true for flair-mid- prefix', () => {
    expect(isMidTierBorder('flair-mid-jade')).toBe(true);
    expect(isMidTierBorder('flair-mid-cobalt')).toBe(true);
    expect(isMidTierBorder('flair-mid-sakura')).toBe(true);
  });

  test('returns false for other prefixes', () => {
    expect(isMidTierBorder('flair-ring-jade')).toBe(false);
    expect(isMidTierBorder('flair-border-rainbow')).toBe(false);
    expect(isMidTierBorder('')).toBe(false);
  });
});

describe('getMidTierTitleClass', () => {
  test('returns flair-title-mid for each mid-tier title', () => {
    expect(getMidTierTitleClass('East Wind')).toBe('flair-title-mid');
    expect(getMidTierTitleClass('Dragon Slayer')).toBe('flair-title-mid');
    expect(getMidTierTitleClass('Dora Hunter')).toBe('flair-title-mid');
  });

  test('returns empty string for non-mid-tier titles', () => {
    expect(getMidTierTitleClass('Chicken Farmer')).toBe('');
    expect(getMidTierTitleClass('Regular')).toBe('');
    expect(getMidTierTitleClass('')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="flairUtils"
```

Expected: FAIL — `isMidTierBorder is not a function` / `getMidTierTitleClass is not a function`

---

### Task 2: Add mid-tier CSS classes and implement the new flairUtils functions

**Files:**
- Modify: `client/src/styles/flair.css`
- Modify: `client/src/utils/flairUtils.ts`

- [ ] **Step 1: Add mid-tier classes to `flair.css`**

Append after the existing `flair-border-inner` block (after line 32):

```css
/* Profile border flair (mid-tier — gradient wrapper, no animation) */
.flair-mid-jade {
  position: relative;
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
  background: linear-gradient(135deg, #10b981, #059669, #34d399, #065f46, #10b981);
}

.flair-mid-cobalt {
  position: relative;
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8, #93c5fd, #1e40af, #3b82f6);
}

.flair-mid-sakura {
  position: relative;
  display: inline-flex;
  border-radius: 9999px;
  padding: 3px;
  background: linear-gradient(135deg, #f472b6, #ec4899, #fbcfe8, #be185d, #f472b6);
}
```

And append after the existing `flair-title-chombo` block at the end of the file:

```css
.flair-title-mid {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1, #94a3b8, #64748b);
  color: #0f172a;
  border: 1px solid #94a3b8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
```

- [ ] **Step 2: Add the two new functions to `flairUtils.ts`**

Append after the existing `getPremiumTitleEmoji` function:

```ts
export function isMidTierBorder(borderValue: string): boolean {
  return borderValue.startsWith('flair-mid-');
}

export function getMidTierTitleClass(titleValue: string): string {
  if (titleValue === 'East Wind') return 'flair-title-mid';
  if (titleValue === 'Dragon Slayer') return 'flair-title-mid';
  if (titleValue === 'Dora Hunter') return 'flair-title-mid';
  return '';
}
```

- [ ] **Step 3: Run flairUtils tests — they should pass now**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="flairUtils"
```

Expected: PASS (8 tests)

- [ ] **Step 4: Commit**

```bash
git add client/src/styles/flair.css client/src/utils/flairUtils.ts client/src/utils/__tests__/flairUtils.test.ts
git commit -m "feat: add mid-tier flair CSS classes and utility functions"
```

---

### Task 3: Update Shop.test.tsx — mid-tier border and title tests

**Files:**
- Modify: `client/src/pages/__tests__/Shop.test.tsx`

- [ ] **Step 1: Update the existing profileBorder hover test**

Find the test `'hovering a profileBorder item applies its class to the preview avatar'` (around line 155). Replace the fixture and assertions:

```tsx
test('hovering a profileBorder item applies its class to the preview avatar', () => {
  const catalogWithBorder = {
    ...mockCatalog,
    profileBorder: [
      {
        _id: 'border1',
        name: 'Jade Ring',
        description: 'A jade ring',
        category: 'profileBorder' as const,
        cost: 250,
        value: 'flair-mid-jade',
        tier: 'mid' as const,
        sortOrder: 3,
        isActive: true,
      } as ShopItem,
    ],
  };
  mockShopUseApi(catalogWithBorder);
  render(<Shop />);

  fireEvent.click(screen.getByRole('button', { name: /borders/i }));

  // Before hover — preview avatar wrapper has no border class
  const avatarDiv = screen.getByTestId('preview-avatar');
  expect(avatarDiv).not.toHaveClass('flair-mid-jade');

  // Fire hover
  const itemCard = screen.getByTestId('flair-item-card-border1');
  fireEvent.mouseEnter(itemCard);

  // After hover — preview avatar wrapper has the gradient border class
  expect(avatarDiv).toHaveClass('flair-mid-jade');
});
```

- [ ] **Step 2: Add a failing test for mid-tier title badge rendering**

Add this test after the existing `'hovering a title item shows that title in the preview'` test:

```tsx
test('mid-tier title item renders with silver metallic badge in item grid', () => {
  const catalogWithMidTitle = {
    ...mockCatalog,
    title: [
      {
        _id: 'title-mid1',
        name: 'East Wind',
        description: 'The dealer seat',
        category: 'title' as const,
        cost: 250,
        value: 'East Wind',
        tier: 'mid' as const,
        sortOrder: 3,
        isActive: true,
      } as ShopItem,
    ],
  };
  mockShopUseApi(catalogWithMidTitle);
  render(<Shop />);

  fireEvent.click(screen.getByRole('button', { name: /titles/i }));

  const itemCard = screen.getByTestId('flair-item-card-title-mid1');
  const badge = itemCard.querySelector('.flair-title-mid');
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveTextContent('East Wind');
});
```

- [ ] **Step 3: Run Shop tests — expect failures on the new and updated tests**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="Shop.test"
```

Expected: Most tests pass, but the border hover test fails (`flair-mid-jade` class not applied to wrapper) and the mid-tier title test fails (`flair-title-mid` class not found).

---

### Task 4: Update Shop.tsx

**Files:**
- Modify: `client/src/pages/Shop.tsx`

- [ ] **Step 1: Update the import line**

Change:
```ts
import { isPremiumBorder, getPremiumTitleClass, getPremiumTitleEmoji } from '../utils/flairUtils';
```
To:
```ts
import { isPremiumBorder, isMidTierBorder, getPremiumTitleClass, getPremiumTitleEmoji, getMidTierTitleClass } from '../utils/flairUtils';
```

- [ ] **Step 2: Update the preview border variable (around line 92)**

Change:
```ts
const previewIsPremiumBorder = isPremiumBorder(previewBorder);
```
To:
```ts
const previewNeedsGradientBorder = isPremiumBorder(previewBorder) || isMidTierBorder(previewBorder);
```

- [ ] **Step 3: Update the preview avatar conditional (around line 139)**

Change:
```tsx
{previewIsPremiumBorder ? (
  <div className={previewBorder} data-testid="preview-avatar">
    <div className="flair-border-inner w-10 h-10 bg-gray-200 flex items-center justify-center">
      <span className="text-gray-400 text-xs">?</span>
    </div>
  </div>
) : (
  <div className={`w-10 h-10 rounded-full bg-gray-200 border border-gray-200 flex items-center justify-center ${previewBorder}`} data-testid="preview-avatar">
    <span className="text-gray-400 text-xs">?</span>
  </div>
)}
```
To:
```tsx
{previewNeedsGradientBorder ? (
  <div className={previewBorder} data-testid="preview-avatar">
    <div className="flair-border-inner w-10 h-10 bg-gray-200 flex items-center justify-center">
      <span className="text-gray-400 text-xs">?</span>
    </div>
  </div>
) : (
  <div className={`w-10 h-10 rounded-full bg-gray-200 border border-gray-200 flex items-center justify-center ${previewBorder}`} data-testid="preview-avatar">
    <span className="text-gray-400 text-xs">?</span>
  </div>
)}
```

- [ ] **Step 4: Update the item grid border preview (around line 204)**

Change:
```tsx
{item.category === 'profileBorder' && (
  item.tier === 'premium' ? (
    <div className={item.value}>
      <div className="flair-border-inner w-8 h-8 bg-gray-300" />
    </div>
  ) : (
    <div className={`w-8 h-8 rounded-full bg-gray-300 ${item.value}`} />
  )
)}
```
To:
```tsx
{item.category === 'profileBorder' && (
  (isPremiumBorder(item.value) || isMidTierBorder(item.value)) ? (
    <div className={item.value}>
      <div className="flair-border-inner w-8 h-8 bg-gray-300" />
    </div>
  ) : (
    <div className={`w-8 h-8 rounded-full bg-gray-300 ${item.value}`} />
  )
)}
```

- [ ] **Step 5: Update the TitleBadge component at the bottom of Shop.tsx (around line 264)**

Change:
```tsx
const TitleBadge: React.FC<{ value: string; tier: ShopItem['tier'] }> = ({ value, tier }) => {
  if (tier === 'premium') {
    const premiumClass = getPremiumTitleClass(value);
    const emoji = getPremiumTitleEmoji(value);
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${premiumClass}`}>
        {emoji && <span className="mr-1">{emoji}</span>}
        {value}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
      {value}
    </span>
  );
};
```
To:
```tsx
const TitleBadge: React.FC<{ value: string; tier: ShopItem['tier'] }> = ({ value, tier }) => {
  if (tier === 'premium') {
    const premiumClass = getPremiumTitleClass(value);
    const emoji = getPremiumTitleEmoji(value);
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${premiumClass}`}>
        {emoji && <span className="mr-1">{emoji}</span>}
        {value}
      </span>
    );
  }
  if (tier === 'mid') {
    const midClass = getMidTierTitleClass(value);
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${midClass}`}>
        {value}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
      {value}
    </span>
  );
};
```

- [ ] **Step 6: Run Shop tests — they should pass now**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="Shop.test"
```

Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Shop.tsx client/src/pages/__tests__/Shop.test.tsx
git commit -m "feat: apply mid-tier gradient border and silver title badge in Shop"
```

---

### Task 5: Write failing test for UserDisplay mid-tier title badge

**Files:**
- Modify: `client/src/components/user/__tests__/UserDisplay.flair.test.tsx`

- [ ] **Step 1: Add mid-tier title test at the end of the describe block**

```tsx
test('renders mid-tier title with silver metallic flair-title-mid class', () => {
  const user = {
    ...baseUser,
    equippedFlair: {
      nameColor: null,
      nameIcon: null,
      profileBorder: null,
      title: 'East Wind',
    },
  };

  render(<UserDisplay user={user} />);

  const badge = document.querySelector('.flair-title-mid');
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveTextContent('East Wind');
});

test('renders mid-tier Dragon Slayer title with flair-title-mid class', () => {
  const user = {
    ...baseUser,
    equippedFlair: {
      nameColor: null,
      nameIcon: null,
      profileBorder: null,
      title: 'Dragon Slayer',
    },
  };

  render(<UserDisplay user={user} />);

  const badge = document.querySelector('.flair-title-mid');
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveTextContent('Dragon Slayer');
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="UserDisplay.flair"
```

Expected: FAIL — East Wind and Dragon Slayer render with `bg-primary-100` class, not `flair-title-mid`

---

### Task 6: Update UserDisplay.tsx TitleBadge

**Files:**
- Modify: `client/src/components/user/UserDisplay.tsx`

- [ ] **Step 1: Update the import at the top of UserDisplay.tsx**

Change:
```ts
import { getPremiumTitleClass, getPremiumTitleEmoji } from '../../utils/flairUtils';
```
To:
```ts
import { getPremiumTitleClass, getPremiumTitleEmoji, getMidTierTitleClass } from '../../utils/flairUtils';
```

- [ ] **Step 2: Update TitleBadge in UserDisplay.tsx (around line 100)**

Change:
```tsx
const PREMIUM_TITLES = new Set(['Chicken Farmer', 'Chombo Chaser']);

const TitleBadge: React.FC<{ value: string }> = ({ value }) => {
  if (PREMIUM_TITLES.has(value)) {
    const premiumClass = getPremiumTitleClass(value);
    const emoji = getPremiumTitleEmoji(value);
    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${premiumClass}`}>
        {emoji && <span className="mr-0.5">{emoji}</span>}
        {value}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
      {value}
    </span>
  );
};
```
To:
```tsx
const PREMIUM_TITLES = new Set(['Chicken Farmer', 'Chombo Chaser']);

const TitleBadge: React.FC<{ value: string }> = ({ value }) => {
  if (PREMIUM_TITLES.has(value)) {
    const premiumClass = getPremiumTitleClass(value);
    const emoji = getPremiumTitleEmoji(value);
    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${premiumClass}`}>
        {emoji && <span className="mr-0.5">{emoji}</span>}
        {value}
      </span>
    );
  }
  const midClass = getMidTierTitleClass(value);
  if (midClass) {
    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${midClass}`}>
        {value}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
      {value}
    </span>
  );
};
```

- [ ] **Step 3: Run UserDisplay tests — they should pass now**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="UserDisplay.flair"
```

Expected: PASS (6 tests)

- [ ] **Step 4: Commit**

```bash
git add client/src/components/user/UserDisplay.tsx client/src/components/user/__tests__/UserDisplay.flair.test.tsx
git commit -m "feat: apply mid-tier silver title badge in UserDisplay"
```

---

### Task 7: Update UserAvatar.tsx to use gradient wrapper for mid-tier borders

**Files:**
- Modify: `client/src/components/user/UserAvatar.tsx`

- [ ] **Step 1: Update the import**

Change:
```ts
import { isPremiumBorder } from '../../utils/flairUtils';
```
To:
```ts
import { isPremiumBorder, isMidTierBorder } from '../../utils/flairUtils';
```

- [ ] **Step 2: Update the border detection variable (around line 49)**

Change:
```ts
const premiumBorder = isPremiumBorder(borderClass);

if (premiumBorder) {
```
To:
```ts
const useGradientWrapper = isPremiumBorder(borderClass) || isMidTierBorder(borderClass);

if (useGradientWrapper) {
```

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
cd client && npm test -- --watchAll=false
```

Expected: PASS (all tests)

- [ ] **Step 4: Commit**

```bash
git add client/src/components/user/UserAvatar.tsx
git commit -m "feat: apply gradient wrapper to mid-tier borders in UserAvatar"
```

---

### Task 8: Update seedShop.js border values

**Files:**
- Modify: `server/scripts/seedShop.js`

- [ ] **Step 1: Update the three mid-tier profileBorder values**

In `server/scripts/seedShop.js`, find the `profileBorder` entries and change:

```js
{ name: 'Jade Ring',   description: 'Rich jade border',              category: 'profileBorder', cost: 250, tier: 'mid', value: 'flair-ring-jade',   sortOrder: 3 },
{ name: 'Cobalt Ring', description: 'Deep cobalt border',            category: 'profileBorder', cost: 250, tier: 'mid', value: 'flair-ring-cobalt', sortOrder: 4 },
{ name: 'Sakura Ring', description: 'Cherry blossom pink border',    category: 'profileBorder', cost: 300, tier: 'mid', value: 'flair-ring-sakura', sortOrder: 5 },
```
To:
```js
{ name: 'Jade Ring',   description: 'Rich jade border',              category: 'profileBorder', cost: 250, tier: 'mid', value: 'flair-mid-jade',   sortOrder: 3 },
{ name: 'Cobalt Ring', description: 'Deep cobalt border',            category: 'profileBorder', cost: 250, tier: 'mid', value: 'flair-mid-cobalt', sortOrder: 4 },
{ name: 'Sakura Ring', description: 'Cherry blossom pink border',    category: 'profileBorder', cost: 300, tier: 'mid', value: 'flair-mid-sakura', sortOrder: 5 },
```

- [ ] **Step 2: Run full test suite one final time**

```bash
cd client && npm test -- --watchAll=false
```

Expected: PASS (all tests)

- [ ] **Step 3: Commit**

```bash
git add server/scripts/seedShop.js
git commit -m "feat: update mid-tier border seed values to flair-mid-* prefix"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `flair-mid-jade/cobalt/sakura` CSS classes — Task 2
- ✅ `flair-title-mid` CSS class — Task 2
- ✅ `isMidTierBorder()` — Task 2
- ✅ `getMidTierTitleClass()` — Task 2
- ✅ `seedShop.js` value updates — Task 8
- ✅ `UserAvatar.tsx` wrapper check — Task 7
- ✅ `Shop.tsx` preview border + item grid + TitleBadge — Task 4
- ✅ `UserDisplay.tsx` TitleBadge — Task 6
- ✅ `Shop.test.tsx` border test updated — Task 3
- ✅ `UserDisplay.flair.test.tsx` mid-tier title tests — Task 5

**No placeholders found.**

**Type consistency:** `isMidTierBorder` and `getMidTierTitleClass` defined in Task 2 and referenced consistently in Tasks 4, 6, 7. Import lines shown completely in each task.
