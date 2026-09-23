# Full-Page Profile Backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small backdrop banner strip in `UserInfoSection` with a full-page background on the profile page — flush with the navbar and footer, full browser width, with every section's card floating translucently on top — while leaving the small preview swatches in Shop/My Flair untouched.

**Architecture:** A new `PageBackdropContext` lets `Profile.tsx` register a background node with `Layout.tsx`'s `<main>`, which is the one element whose box exactly spans navbar-bottom to footer-top. A new `ProfilePageBackdrop` component (sibling of the existing `ProfileBackdrop`, same value-registry guard) supplies that node. CSS does the rest: a `position: absolute` full-bleed layer behind `<main>`'s content, and a `[data-flair-backdrop] .card` rule that makes cards translucent only on the profile page, only when a valid backdrop is equipped.

**Tech Stack:** React 18 (TypeScript, function components + hooks), Jest + React Testing Library, Tailwind (via the existing `.card` utility class) + hand-written CSS in `flair.css`.

Source spec: `docs/superpowers/specs/2026-09-23-full-page-profile-backdrop-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `client/src/contexts/PageBackdropContext.tsx` (new) | Context + `usePageBackdrop(node)` hook. Any page can register a background node; `Layout` renders whatever's currently registered, or nothing. |
| `client/src/components/Layout.tsx` (modify) | Holds the registered node in state, provides the context, renders the node as the first child of `<main>` (now `position: relative`). |
| `client/src/components/user/ProfilePageBackdrop.tsx` (new) | Sibling of `ProfileBackdrop.tsx` — same "unknown value renders nothing" guard, different shape: a full-bleed `aria-hidden` layer instead of a fixed-height strip. |
| `client/src/styles/flair.css` (modify) | New `.profile-page-backdrop` positioning rules and `[data-flair-backdrop] .card` translucency rule, plus `@media print` fallbacks. No changes to existing backdrop color/gradient/animation classes — they're reused as-is. |
| `client/src/pages/Profile.tsx` (modify) | Computes whether a valid, visible backdrop is equipped; registers `ProfilePageBackdrop` via `usePageBackdrop`; marks its own root element with `data-flair-backdrop`. |
| `client/src/components/profile/UserInfoSection.tsx` (modify) | Loses the old backdrop banner and its now-unused `ProfileBackdrop` import. |

Each file above has exactly one job: the context is transport, `Layout` is the one place that knows where navbar-bottom/footer-top actually is, `ProfilePageBackdrop` is presentation, the CSS is styling, and `Profile.tsx` is the only place that decides *whether* a backdrop applies (using the same privacy rule the rest of the page already uses). `Shop.tsx`, `MyFlairSection.tsx`, `FlairItemPreview.tsx`, `FlairSample.tsx`, and `ProfileBackdrop.tsx` itself are untouched — they keep the small-swatch behavior that already works correctly.

---

### Task 1: `PageBackdropContext` + wire it into `Layout.tsx`

**Files:**
- Create: `client/src/contexts/PageBackdropContext.tsx`
- Modify: `client/src/components/Layout.tsx`
- Test: `client/src/components/__tests__/Layout.test.tsx`

There's no independent unit test for the context file on its own — a `createContext`/`useEffect` pair has no observable behavior except through a provider and a consumer, so it's tested here, through its real host (`Layout`) and a minimal test consumer.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/__tests__/Layout.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Layout from '../Layout';
import { usePageBackdrop } from '../../contexts/PageBackdropContext';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, logout: jest.fn() }),
}));

jest.mock('../NotificationDropdown', () => () => null);

const BackdropSetter: React.FC<{ node: React.ReactNode }> = ({ node }) => {
  usePageBackdrop(node);
  return null;
};

describe('Layout page backdrop', () => {
  test('renders <main> unchanged when no page registers a backdrop', () => {
    render(
      <Layout>
        <div data-testid="page-content" />
      </Layout>
    );

    const main = screen.getByTestId('layout-main');
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(main.children).toHaveLength(1);
  });

  test('renders a registered page backdrop inside <main>, before the page content', () => {
    render(
      <Layout>
        <BackdropSetter node={<div data-testid="test-backdrop" />} />
        <div data-testid="page-content" />
      </Layout>
    );

    const main = screen.getByTestId('layout-main');
    expect(screen.getByTestId('test-backdrop')).toBeInTheDocument();
    expect(main.firstElementChild).toBe(screen.getByTestId('test-backdrop'));
  });

  test('clears the backdrop when the registering component unmounts', () => {
    const { rerender } = render(
      <Layout>
        <BackdropSetter node={<div data-testid="test-backdrop" />} />
        <div data-testid="page-content" />
      </Layout>
    );
    expect(screen.getByTestId('test-backdrop')).toBeInTheDocument();

    rerender(
      <Layout>
        <div data-testid="page-content" />
      </Layout>
    );

    expect(screen.queryByTestId('test-backdrop')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="components/__tests__/Layout"`
Expected: FAIL — `Cannot find module '../../contexts/PageBackdropContext'` (and `getByTestId('layout-main')` doesn't exist yet either).

- [ ] **Step 3: Create the context file**

Create `client/src/contexts/PageBackdropContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, ReactNode } from 'react';

// Lets a page register a background node with Layout's <main> without Layout needing to know
// anything about what that node is. The default no-op setter means a component can call
// usePageBackdrop safely even in tests that render it without a <Layout> ancestor.
export const PageBackdropContext = createContext<(node: ReactNode) => void>(() => {});

// Callers must pass a stable `node` (e.g. wrap it in useMemo keyed on its real inputs) — a new
// element reference every render would re-register on every render, and since Layout holding new
// state re-renders its children, that would re-run this effect every render too.
export const usePageBackdrop = (node: ReactNode) => {
  const setBackdrop = useContext(PageBackdropContext);

  useEffect(() => {
    setBackdrop(node);
    return () => setBackdrop(null);
  }, [node, setBackdrop]);
};
```

- [ ] **Step 4: Wire it into `Layout.tsx`**

Modify `client/src/components/Layout.tsx`. Add the import after the existing `react-icons/fa` import (line 20):

```tsx
import { FaFacebook, FaInstagram, FaDiscord, FaMeetup } from 'react-icons/fa';
import { PageBackdropContext } from '../contexts/PageBackdropContext';
```

Add a new piece of state alongside the existing ones (after line 31, `isMobilePlayOpen`):

```tsx
  const [isMobilePlayOpen, setIsMobilePlayOpen] = useState(false);
  const [pageBackdrop, setPageBackdrop] = useState<React.ReactNode>(null);
```

Wrap the returned JSX in the provider, and give `<main>` the registered node, `position: relative`,
and a test id. The full return statement (previously starting at line 71) becomes:

```tsx
  return (
    <PageBackdropContext.Provider value={setPageBackdrop}>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
```

...(the nav and mobile-menu JSX in between is unchanged)...

```tsx
      {/* Main content */}
      <main data-testid="layout-main" className="flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full relative">
        {pageBackdrop}
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
```

...(the footer JSX is unchanged)...

```tsx
    </div>
    </PageBackdropContext.Provider>
  );
};

export default Layout;
```

Concretely: only three edits to the existing file — (1) the new import, (2) the new `useState`
line, (3) replace `<div className="min-h-screen bg-gray-50 flex flex-col">` with
`<PageBackdropContext.Provider value={setPageBackdrop}>\n    <div className="min-h-screen bg-gray-50 flex flex-col">`,
replace the `<main className="flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full">` line with
`<main data-testid="layout-main" className="flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full relative">`
and add `{pageBackdrop}` immediately before `{children}` inside it, and replace the closing
`    </div>\n  );` at the end of the component with `    </div>\n    </PageBackdropContext.Provider>\n  );`.
Nothing else in the 442-line file changes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="components/__tests__/Layout"`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the rest of the client suite to check for regressions**

Run: `cd client && npm test -- --watchAll=false`
Expected: PASS, same total count as before plus 3. (This is the main regression guard for the
31 other `.card` usages across the app — none of them are inside a `[data-flair-backdrop]`
ancestor, so this task's CSS-facing change in Task 4 won't touch them, but nothing here yet
should change their rendered output either.)

- [ ] **Step 7: Commit**

```bash
git add client/src/contexts/PageBackdropContext.tsx client/src/components/Layout.tsx client/src/components/__tests__/Layout.test.tsx
git commit -m "feat: add PageBackdropContext so a page can register a background with Layout"
```

---

### Task 2: `ProfilePageBackdrop` component

**Files:**
- Create: `client/src/components/user/ProfilePageBackdrop.tsx`
- Test: `client/src/components/user/__tests__/ProfilePageBackdrop.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/user/__tests__/ProfilePageBackdrop.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilePageBackdrop from '../ProfilePageBackdrop';

describe('ProfilePageBackdrop', () => {
  test('renders the full-page layer carrying the backdrop class', () => {
    render(<ProfilePageBackdrop value="flair-backdrop-koi" />);

    const layer = screen.getByTestId('profile-page-backdrop');
    expect(layer).toHaveClass('profile-page-backdrop', 'flair-backdrop-koi');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
  });

  test.each([null, undefined, ''])('renders nothing for an empty value (%p)', value => {
    const { container } = render(<ProfilePageBackdrop value={value} />);

    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing for a value that is not a known backdrop', () => {
    const { container } = render(<ProfilePageBackdrop value="text-red-600 hidden" />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="ProfilePageBackdrop"`
Expected: FAIL — `Cannot find module '../ProfilePageBackdrop'`

- [ ] **Step 3: Write the component**

Create `client/src/components/user/ProfilePageBackdrop.tsx`:

```tsx
import React from 'react';
import { getBackdropStyle } from '../../utils/flairUtils';

interface ProfilePageBackdropProps {
  value: string | null | undefined;
}

// A full-page background layer for the profile page: breaks out of the centered content column
// to fill the browser width, and fills its positioned ancestor's height (Layout's <main>) via
// `.profile-page-backdrop` in flair.css. Registered with Layout through usePageBackdrop rather
// than rendered inline, since it needs to sit behind everything in <main>, flush with the navbar
// and footer — see docs/superpowers/specs/2026-09-23-full-page-profile-backdrop-design.md.
const ProfilePageBackdrop: React.FC<ProfilePageBackdropProps> = ({ value }) => {
  if (!value || !getBackdropStyle(value)) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="profile-page-backdrop"
      className={['profile-page-backdrop', value].join(' ')}
    />
  );
};

export default ProfilePageBackdrop;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="ProfilePageBackdrop"`
Expected: PASS (5 tests: the "renders the layer" test, the "unknown value" test, and 3 cases from
the `test.each`)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/user/ProfilePageBackdrop.tsx client/src/components/user/__tests__/ProfilePageBackdrop.test.tsx
git commit -m "feat: add ProfilePageBackdrop, a full-bleed variant of ProfileBackdrop"
```

---

### Task 3: CSS — full-page layer positioning and translucent cards

**Files:**
- Modify: `client/src/styles/flair.css`

No dedicated automated test: this file has no visual-regression tooling, and jsdom (used by the
Jest tests elsewhere in this plan) doesn't apply real CSS layout, so class *presence* is what's
tested (Tasks 1, 2, 4), and the actual visual result is checked manually in Task 6. The one
existing guard test that reads this file, `flairCatalog.test.ts`, only checks the hand-synced
per-tier selector lists for `nameColor`/`nameIcon`/`profileBorder`/`profileBackdrop`/`title`
classes — it doesn't enumerate page-layout rules like the ones added here, so it isn't affected.

- [ ] **Step 1: Update the section header comment**

In `client/src/styles/flair.css`, find (around line 354):

```css
/* ==========================================================================
   Profile backdrops: a decorative banner strip behind the profile header (ProfileBackdrop).
   No text is ever drawn on it, so the gradient text-clip fallbacks above do not apply; when
   forced-colors or print drop the background the strip simply disappears.
   ========================================================================== */
```

Replace with:

```css
/* ==========================================================================
   Profile backdrops. The same classes back two renderings: a small decorative strip
   (ProfileBackdrop, used in the Shop/My Flair preview boxes) and a full-page layer behind the
   actual profile page (ProfilePageBackdrop, registered with Layout's <main> — see below). No
   text is ever drawn on either, so the gradient text-clip fallbacks above do not apply; when
   forced-colors or print drop the background, both simply disappear.
   ========================================================================== */
```

- [ ] **Step 2: Add the full-page layer and card-translucency rules**

Immediately after this block (around line 373-377):

```css
.flair-backdrop-tanabata,
.flair-backdrop-koi {
  background-size: 300% 100%;
  animation: flair-flow 12s linear infinite;
}
```

Insert:

```css

/* Full-page layer (ProfilePageBackdrop): breaks out of the centered content column to the full
   browser width, and fills the height of its positioned ancestor (Layout's <main>, flush with
   the navbar and footer) rather than taking an explicit height like the small preview strip. */
.profile-page-backdrop {
  position: absolute;
  inset-block: 0;
  left: 50%;
  width: 100vw;
  transform: translateX(-50%);
  z-index: -1;
}

/* Cards sit on top of the full-page layer translucently, so the backdrop reads through the page
   instead of only showing in the gaps between cards. Scoped to Profile.tsx's own
   data-flair-backdrop attribute, set only when a valid backdrop is equipped, so no other page's
   .card (used in 30+ other places) is affected. */
[data-flair-backdrop] .card {
  background-color: rgb(255 255 255 / 0.85);
  backdrop-filter: blur(3px);
}

@media print {
  .profile-page-backdrop {
    display: none;
  }

  [data-flair-backdrop] .card {
    background-color: #fff;
    backdrop-filter: none;
  }
}
```

The following "Reduced motion" section is unchanged — `.flair-backdrop-tanabata`/`-koi`'s
animation is already covered there by class name, and `ProfilePageBackdrop` reuses those same
classes, so no new rule is needed for reduced motion.

- [ ] **Step 3: Confirm the client still builds and lints clean**

Run: `cd client && npx prettier --check src/styles/flair.css`
Expected: no output (already formatted) — if it reports the file, run
`npx prettier --write src/styles/flair.css` and re-check.

Run: `cd client && npm test -- --watchAll=false --testPathPattern="flairCatalog"`
Expected: PASS (unaffected, per Step 0 note above — confirms this edit didn't break the
hand-synced selector list guard).

- [ ] **Step 4: Commit**

```bash
git add client/src/styles/flair.css
git commit -m "feat: add full-page backdrop layer and translucent-card CSS for the profile page"
```

---

### Task 4: Wire `Profile.tsx`

**Files:**
- Modify: `client/src/pages/Profile.tsx`
- Test: `client/src/pages/__tests__/Profile.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `client/src/pages/__tests__/Profile.test.tsx`, after the existing
`describe('Profile page admin points link', ...)` block:

```tsx
describe('Profile page backdrop', () => {
  function setupBackdrop({
    id,
    currentUser,
    viewedUserOverrides = {},
  }: {
    id: string | undefined;
    currentUser: Record<string, unknown>;
    viewedUserOverrides?: Record<string, unknown>;
  }) {
    mockUseParams.mockReturnValue({ id });
    mockUseAuth.mockReturnValue({
      user: { _id: 'admin-1', isAdmin: false, ...currentUser },
      updateProfile: jest.fn(),
    });
    let callCount = 0;
    const user = { ...viewedUser, ...viewedUserOverrides };
    mockUseApi.mockImplementation(() => {
      callCount += 1;
      const isProfileCall = callCount % 2 === 1;
      return isProfileCall
        ? { data: user, loading: false, error: null, refetch: jest.fn() }
        : { data: [], loading: false, error: null, refetch: jest.fn() };
    });
  }

  test('sets data-flair-backdrop when the viewed user has a known backdrop equipped and is not private', () => {
    setupBackdrop({
      id: 'user-2',
      currentUser: {},
      viewedUserOverrides: { equippedFlair: { profileBackdrop: 'flair-backdrop-fuji' } },
    });

    const { container } = render(<Profile />);

    expect(container.querySelector('[data-flair-backdrop]')).not.toBeNull();
  });

  test('omits data-flair-backdrop when no backdrop is equipped', () => {
    setupBackdrop({
      id: 'user-2',
      currentUser: {},
      viewedUserOverrides: { equippedFlair: { profileBackdrop: null } },
    });

    const { container } = render(<Profile />);

    expect(container.querySelector('[data-flair-backdrop]')).toBeNull();
  });

  test('omits data-flair-backdrop for an unknown backdrop value', () => {
    setupBackdrop({
      id: 'user-2',
      currentUser: {},
      viewedUserOverrides: { equippedFlair: { profileBackdrop: 'not-a-real-backdrop' } },
    });

    const { container } = render(<Profile />);

    expect(container.querySelector('[data-flair-backdrop]')).toBeNull();
  });

  test('omits data-flair-backdrop on your own profile when private mode is on', () => {
    setupBackdrop({
      id: undefined,
      currentUser: {
        _id: 'admin-1',
        privateMode: true,
        equippedFlair: { profileBackdrop: 'flair-backdrop-fuji' },
      },
    });

    const { container } = render(<Profile />);

    expect(container.querySelector('[data-flair-backdrop]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/Profile"`
Expected: FAIL on the first three ("sets/omits data-flair-backdrop...") — `Profile.tsx` doesn't
set the attribute yet, so `container.querySelector('[data-flair-backdrop]')` is always `null`. The
fourth test passes vacuously before the change (also asserts `null`) but is kept to guard the
private-mode case once the attribute exists.

- [ ] **Step 3: Add the imports**

In `client/src/pages/Profile.tsx`, after the existing imports (after
`import PointsSection from '../components/profile/PointsSection';`):

```tsx
import PointsSection from '../components/profile/PointsSection';
import { getBackdropStyle } from '../utils/flairUtils';
import { usePageBackdrop } from '../contexts/PageBackdropContext';
import ProfilePageBackdrop from '../components/user/ProfilePageBackdrop';
```

- [ ] **Step 4: Compute `hasBackdrop` and register it**

Insert after the existing `refetchProfile` callback and before the `profileUserLoading` early
return:

```tsx
  const refetchProfile = React.useCallback(async () => {
    await refetchProfileUser();
  }, [refetchProfileUser]);

  // Full-page backdrop: shown on any profile (yours or another member's) that isn't private and
  // has a known backdrop equipped — the same privacy gate the server already applies to
  // equippedFlair.profileBackdrop in User.toJSON().
  const backdropValue = !user?.privateMode ? user?.equippedFlair?.profileBackdrop ?? null : null;
  const hasBackdrop = !!backdropValue && !!getBackdropStyle(backdropValue);
  // Memoized so the registered node's identity is stable across re-renders where hasBackdrop/
  // backdropValue haven't changed. usePageBackdrop's effect re-registers whenever the node
  // reference changes; an unmemoized JSX literal here would be a new reference every render
  // (Layout re-renders Profile whenever pageBackdrop state changes), which would re-run the
  // effect every render.
  const pageBackdropNode = React.useMemo(
    () => (hasBackdrop ? <ProfilePageBackdrop value={backdropValue} /> : null),
    [hasBackdrop, backdropValue]
  );
  usePageBackdrop(pageBackdropNode);

  if (profileUserLoading || !user) {
```

- [ ] **Step 5: Mark the root element**

Find the main return's root div:

```tsx
  return (
    <div className="space-y-8">
```

Replace with:

```tsx
  return (
    <div className="space-y-8" data-flair-backdrop={hasBackdrop ? '' : undefined}>
```

(React omits an attribute entirely when its value is `undefined`, so this adds nothing to the DOM
when `hasBackdrop` is `false`.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/Profile"`
Expected: PASS (6 tests: 2 existing admin-link tests + 4 new backdrop tests)

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Profile.tsx client/src/pages/__tests__/Profile.test.tsx
git commit -m "feat: register the full-page backdrop from Profile.tsx"
```

---

### Task 5: Remove the old backdrop banner from `UserInfoSection`

**Files:**
- Modify: `client/src/components/profile/UserInfoSection.tsx`
- Modify: `client/src/components/profile/UserInfoSection.test.tsx`

- [ ] **Step 1: Remove the obsolete tests first**

In `client/src/components/profile/UserInfoSection.test.tsx`, inside the
`describe('UserInfoSection backdrop and showcase', ...)` block, delete these three tests (keep
the `beforeEach`/`afterEach` and the showcase tests — they're unrelated, `ProfileShowcase` still
uses `shopApi.getInventory`):

```tsx
  test('renders the equipped backdrop behind the header', () => {
    renderSection({ ...baseUser, equippedFlair: { profileBackdrop: 'flair-backdrop-fuji' } });

    expect(screen.getByTestId('profile-backdrop')).toHaveClass('flair-backdrop-fuji');
  });

  test('renders no backdrop when none is equipped', () => {
    renderSection({ ...baseUser, equippedFlair: { profileBackdrop: null } });

    expect(screen.queryByTestId('profile-backdrop')).not.toBeInTheDocument();
  });

  test('renders no backdrop in private mode even if one comes through', () => {
    renderSection({ ...baseUser, privateMode: true, equippedFlair: { profileBackdrop: 'flair-backdrop-fuji' } });

    expect(screen.queryByTestId('profile-backdrop')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the suite to confirm it's green with the old assertions gone**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="UserInfoSection"`
Expected: PASS (still renders `ProfileBackdrop` at this point, so nothing to fail yet — this step
just confirms removing the tests didn't break test-file syntax before touching the component).

- [ ] **Step 3: Remove the banner and its import**

In `client/src/components/profile/UserInfoSection.tsx`, remove the import (currently line 9):

```tsx
import ProfileBackdrop from '../user/ProfileBackdrop';
```

Remove the banner block from the render body:

```tsx
      <div className="space-y-4">
          {/* Backdrop banner: profile-only flair, hidden in private mode */}
          {!user?.privateMode && (
            <ProfileBackdrop value={user?.equippedFlair?.profileBackdrop} className="h-20" />
          )}

          {/* Avatar and Display Name */}
```

becomes:

```tsx
      <div className="space-y-4">
          {/* Avatar and Display Name */}
```

- [ ] **Step 4: Run the suite to verify everything still passes**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="UserInfoSection"`
Expected: PASS (all remaining tests, including the showcase ones)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/profile/UserInfoSection.tsx client/src/components/profile/UserInfoSection.test.tsx
git commit -m "fix: remove the small backdrop banner from UserInfoSection, replaced by the full-page layer"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire client test suite**

Run: `cd client && npm test -- --watchAll=false`
Expected: PASS, no failures.

- [ ] **Step 2: Run prettier across the changed files**

Run: `cd client && npx prettier --check src/contexts/PageBackdropContext.tsx src/components/Layout.tsx src/components/user/ProfilePageBackdrop.tsx src/styles/flair.css src/pages/Profile.tsx src/components/profile/UserInfoSection.tsx`
Expected: no output. If any file is reported, run the same command with `--write` and re-run
Step 1.

- [ ] **Step 3: Manual smoke check in a browser**

Start the frontend dev server (`cd client && npm start`) and the backend (`cd server && npm run
dev`) per `CLAUDE.md`. As a user with a `profileBackdrop` item purchased and equipped (use the
Shop, or equip one from the existing "My Flair" panel):

- Visit `/profile`. Confirm: the backdrop fills the page edge-to-edge, flush against the navbar
  and footer, behind every section; cards are translucent; the backdrop scrolls normally with the
  page.
- Unequip the backdrop (or view a profile that never had one). Confirm: the page looks exactly as
  it did before this change — plain grey background, opaque cards.
- If the equipped backdrop is `flair-backdrop-tanabata` or `flair-backdrop-koi` (the two animated
  premium ones), confirm the flow animation still plays, and that it's visually reasonable
  stretched across the full page width — if the motion reads too fast/slow at this new scale,
  note it as a follow-up (the spec's Non-Goals section already flags animation timing as
  out-of-scope for this change, tuned for the old small strip).
- Visit `/shop` and the "My Flair" panel; confirm both still show the small preview strip for
  backdrop items, unchanged from before this plan.
- Turn on your own private mode and revisit `/profile`; confirm no backdrop shows (plain page).

- [ ] **Step 4: Report results to the user**

Summarize what was tested (test suite pass count, prettier check, manual smoke check outcome) —
do not claim the visual result is correct without having actually looked at it in a browser, per
this repo's verification standard.
