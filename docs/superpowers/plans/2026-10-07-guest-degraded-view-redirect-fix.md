# Guest Degraded-View Redirect Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a background 401 from any page hard-redirecting the browser to `/login`, and fix the one confirmed case (`Home.tsx`) where that currently bounces a logged-out guest off a page that's supposed to show them a degraded view.

**Architecture:** Move the API layer from "redirect the browser on any 401" to "report failure and tell `AuthContext` the session is gone." `AuthContext.logout()` (already exists) handles clearing state; `useRequireAuth()` (already exists, unchanged) is the only thing that ever calls `navigate('/login?...')`, and it already reacts to `isAuthenticated` flipping to `false` at any time, not just on initial load. Separately, `Home.tsx` stops making an authenticated call it doesn't need to make as a guest.

**Tech Stack:** TypeScript, React 18, Jest, React Testing Library (`renderHook`, `act`, `waitFor` from `@testing-library/react`).

---

## Spec Reference

This plan implements `docs/superpowers/specs/2026-10-07-guest-degraded-view-redirect-fix-design.md`. Scope is a mechanism fix only — no page is being moved between the "fully gated" and "guest-facing" groups.

## File Structure

- Modify: `client/src/services/api.ts` — remove the hard redirect from `apiRequest`'s 401 branch; add `setUnauthorizedHandler`.
- Create: `client/src/services/__tests__/api.test.ts` — covers the new 401 behavior.
- Modify: `client/src/contexts/AuthContext.tsx` — register `logout` as the unauthorized handler on mount.
- Create: `client/src/contexts/__tests__/AuthContext.test.tsx` — covers the registration and the effect of the handler firing.
- Create: `client/src/hooks/__tests__/useRequireAuth.test.ts` — no production code change, but this hook has zero existing test coverage and is now load-bearing for a case (mid-session auth loss) it wasn't exercised for before. Covers both the pre-existing initial-load redirect and the new mid-session case.
- Modify: `client/src/pages/Home.tsx` — gate `getLeague()` behind `isAuthenticated`, mirroring the existing `getGames()` guard.
- Modify: `client/src/pages/__tests__/Home.test.tsx` — add a guest-view test asserting the league endpoint is never called.
- Verify only (no change expected): `client/src/pages/TournamentDetail.tsx`, `client/src/pages/TournamentWaitlist.tsx` — confirm neither has a Home-style unconditional authenticated call hiding behind its public/private endpoint split.

---

### Task 1: Remove the hard redirect from the API layer

**Files:**
- Modify: `client/src/services/api.ts:293-336`
- Test: `client/src/services/__tests__/api.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `client/src/services/__tests__/api.test.ts`:

```ts
import { tournamentsApi, setUnauthorizedHandler } from '../api';

describe('apiRequest 401 handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    setUnauthorizedHandler(() => {});
  });

  test('throws Unauthorized without navigating the browser', async () => {
    const before = window.location.href;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid token' }),
    }) as unknown as typeof fetch;

    await expect(tournamentsApi.getTournaments(1, 20)).rejects.toThrow('Unauthorized');
    expect(window.location.href).toBe(before);
  });

  test('invokes the registered unauthorized handler exactly once per failed call', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    await expect(tournamentsApi.getTournaments(1, 20)).rejects.toThrow();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a non-401 error still throws the server message and does not touch the handler', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Database unavailable' }),
    }) as unknown as typeof fetch;
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    await expect(tournamentsApi.getTournaments(1, 20)).rejects.toThrow('Database unavailable');

    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="services/__tests__/api.test"`

Expected: The first test FAILs (current code sets `window.location.href`, so `window.location.href` no longer equals `before`). The second test FAILs with `TypeError: setUnauthorizedHandler is not a function` (not exported yet). The third test should already PASS (500 handling is unchanged) — that's fine, it's there to pin down existing behavior while the other two go red.

- [ ] **Step 3: Implement the fix**

In `client/src/services/api.ts`, locate the `getAuthToken` helper (currently lines 293-296) and the `apiRequest` function right after it (currently lines 298-336):

Replace:

```ts
// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Helper function to make API requests
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      // Don't redirect if we're already on the login page
      if (window.location.pathname === '/login') {
        // Already on login page, don't redirect
        throw new Error('Unauthorized');
      }
      const currentPath = window.location.pathname + window.location.search;
      const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
      window.location.href = loginUrl;
      // Throw error to stop execution
      throw new Error('Unauthorized - redirecting to login');
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};
```

With:

```ts
// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Registered by AuthContext so a 401 from any call can clear the stale session.
// Kept out of AuthContext's own import graph (AuthContext imports this file) by
// having AuthContext push a callback in here instead of this file reaching back out.
let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: () => void): void => {
  onUnauthorized = handler;
};

// Helper function to make API requests
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorized?.();
      throw new Error('Unauthorized');
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="services/__tests__/api.test"`

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/services/api.ts client/src/services/__tests__/api.test.ts
git commit -m "fix: stop apiRequest from hard-redirecting on 401

A background 401 used to call window.location.href = '/login?...'
directly, racing ahead of any try/catch in the calling page. This
is what let a failed background call (e.g. Home's ranked-league
fetch) yank a guest off a page meant to show them a degraded view.
apiRequest now just reports the failure; AuthContext decides what
to do with it (see next commit)."
```

---

### Task 2: Wire AuthContext to clear state on any 401

**Files:**
- Modify: `client/src/contexts/AuthContext.tsx`
- Test: `client/src/contexts/__tests__/AuthContext.test.tsx` (new)

- [ ] **Step 1: Write the failing tests**

Create `client/src/contexts/__tests__/AuthContext.test.tsx`:

```tsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../../services/api', () => ({
  authApi: { login: jest.fn(), register: jest.fn() },
  usersApi: { getProfile: jest.fn(), updateProfile: jest.fn() },
  setUnauthorizedHandler: jest.fn(),
}));

const { usersApi, setUnauthorizedHandler } = require('../../services/api');

function Consumer() {
  const { isAuthenticated } = useAuth();
  return <div>{isAuthenticated ? 'in' : 'out'}</div>;
}

describe('AuthContext unauthorized handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('registers logout as the unauthorized handler on mount', () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(setUnauthorizedHandler).toHaveBeenCalledTimes(1);
    expect(typeof setUnauthorizedHandler.mock.calls[0][0]).toBe('function');
  });

  test('clears auth state and the stored token when the registered handler fires', async () => {
    localStorage.setItem('authToken', 'token123');
    usersApi.getProfile.mockResolvedValue({
      data: { user: { _id: 'u1', displayName: 'Tester' } },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await screen.findByText('in');

    const registeredHandler = setUnauthorizedHandler.mock.calls[0][0];
    act(() => {
      registeredHandler();
    });

    expect(await screen.findByText('out')).toBeInTheDocument();
    expect(localStorage.getItem('authToken')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="contexts/__tests__/AuthContext.test"`

Expected: Both FAIL — `setUnauthorizedHandler` is never called, since `AuthContext.tsx` doesn't call it yet.

- [ ] **Step 3: Implement the fix**

In `client/src/contexts/AuthContext.tsx`, update the import on line 2 and add a registration effect.

Replace:

```ts
import { authApi, usersApi, User } from '../services/api';
```

With:

```ts
import { authApi, usersApi, setUnauthorizedHandler, User } from '../services/api';
```

Then, immediately after the existing `logout` function definition (currently lines 102-106):

```ts
  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };
```

Add a new effect right after it (before `updateProfile`):

```ts
  // Any 401 from any API call means the session is no longer valid — clear it the
  // same way an explicit logout would. Pages that require auth will react to
  // isAuthenticated flipping to false via useRequireAuth; guest-facing pages just
  // fall back to their logged-out view.
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="contexts/__tests__/AuthContext.test"`

Expected: Both PASS.

- [ ] **Step 5: Run the full client test suite to check for regressions**

Run: `cd client && npm test -- --watchAll=false`

Expected: PASS (no existing test asserts on the old `window.location.href` redirect behavior — confirmed during planning via a repo-wide search).

- [ ] **Step 6: Commit**

```bash
git add client/src/contexts/AuthContext.tsx client/src/contexts/__tests__/AuthContext.test.tsx
git commit -m "fix: have AuthContext clear session state on any 401

Registers the existing logout() function as apiRequest's
unauthorized handler. isAuthenticated now flips to false the
instant any call 401s, not just on an explicit logout — which is
what lets useRequireAuth (unchanged) redirect gated pages on a
mid-session token expiry, and lets guest-facing pages just fall
back to their logged-out view instead of being redirected at all."
```

---

### Task 3: Cover useRequireAuth's mid-session redirect case

**Files:**
- Test: `client/src/hooks/__tests__/useRequireAuth.test.ts` (new)

No production code change in this task — `useRequireAuth.ts` already watches `isAuthenticated` in its effect's dependency array, so it already redirects correctly when auth is lost after mount, not just when a page loads already logged out. This task is pure verification: the hook has no existing test file at all, and after Task 2 it's now relied on for a case (mid-session 401) it was never actually exercised for. Both steps below are expected to go green without touching `useRequireAuth.ts`.

- [ ] **Step 1: Write the tests**

Create `client/src/hooks/__tests__/useRequireAuth.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { useRequireAuth } from '../useRequireAuth';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/tournaments', search: '' }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const { useAuth } = require('../../contexts/AuthContext');

describe('useRequireAuth', () => {
  test('redirects to login with a return path once auth finishes loading and the user is unauthenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });

    renderHook(() => useRequireAuth());

    expect(mockNavigate).toHaveBeenCalledWith('/login?redirect=%2Ftournaments');
  });

  test('does not redirect while auth is still loading', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });

    renderHook(() => useRequireAuth());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('redirects with the same return path when a previously authenticated session becomes unauthenticated mid-session', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    const { rerender } = renderHook(() => useRequireAuth());

    expect(mockNavigate).not.toHaveBeenCalled();

    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    rerender();

    expect(mockNavigate).toHaveBeenCalledWith('/login?redirect=%2Ftournaments');
  });
});
```

- [ ] **Step 2: Run the tests to verify they pass as-is**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="hooks/__tests__/useRequireAuth.test"`

Expected: All 3 PASS without any change to `useRequireAuth.ts`. If any of them fail, stop and re-examine the hook — that would mean the design's assumption about the hook's existing behavior was wrong, which changes the shape of Tasks 1-2.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/__tests__/useRequireAuth.test.ts
git commit -m "test: cover useRequireAuth's mid-session redirect case

Pins down that the hook already redirects correctly when
isAuthenticated flips from true to false after mount, not just on
initial load — this is now load-bearing since AuthContext can
trigger that transition from any 401, not just an explicit logout."
```

---

### Task 4: Stop Home.tsx from making a doomed authenticated call as a guest

**Files:**
- Modify: `client/src/pages/Home.tsx:52-56`
- Modify: `client/src/pages/__tests__/Home.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this new `describe` block to the end of `client/src/pages/__tests__/Home.test.tsx` (after the existing `Home ranked league card` block):

```tsx
describe('Home — guest league fetch', () => {
  test('does not call rankedLeaguesApi.getCurrent for a guest', async () => {
    const { rankedLeaguesApi } = require('../../services/api');
    useAuth.mockReturnValue({ isAuthenticated: false, user: null });
    usePaginatedApi.mockReturnValue({ data: [], loading: false });
    useApi.mockReturnValue({ data: null, loading: false });

    render(<Home />);

    // useApi is mocked, so it never actually invokes the callbacks passed to it.
    // The first call is the tournaments fetch, the second is the league fetch —
    // invoke that one directly to exercise its real gating logic.
    const leagueCallback = useApi.mock.calls[1][0];
    await leagueCallback();

    expect(rankedLeaguesApi.getCurrent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/Home.test"`

Expected: The new test FAILs — `rankedLeaguesApi.getCurrent` has been called, because `Home.tsx`'s current `getLeague` callback calls it unconditionally.

- [ ] **Step 3: Implement the fix**

In `client/src/pages/Home.tsx`, replace (currently lines 52-56):

```ts
  const getLeague = React.useCallback(
    () => rankedLeaguesApi.getCurrent(),
    []
  );
  const { data: leagueResponse, loading: leagueLoading } = useApi<ApiResponse<{ league: RankedLeague }>>(getLeague);
```

With:

```ts
  const getLeague = React.useCallback(() => {
    if (!isAuthenticated) {
      return Promise.resolve(null);
    }
    return rankedLeaguesApi.getCurrent();
  }, [isAuthenticated]);
  const { data: leagueResponse, loading: leagueLoading } = useApi<ApiResponse<{ league: RankedLeague }> | null>(getLeague);
```

No other line in `Home.tsx` needs to change: `league = leagueResponse?.data?.league ?? null` (line 58) already treats a `null` `leagueResponse` the same as a response with no league in it, and every value derived from `league` downstream already null-checks it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/Home.test"`

Expected: All tests in this file PASS, including the new one and every pre-existing authenticated-view test (they're unaffected — `useApi` is mocked in this file, so the authenticated tests never actually exercise the new `if (!isAuthenticated)` branch; they stub the resolved value directly).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Home.tsx client/src/pages/__tests__/Home.test.tsx
git commit -m "fix: don't fetch the ranked league for a guest on Home

getLeague() was unconditional, unlike the adjacent getGames()
callback which already checked isAuthenticated. /api/ranked-leagues
requires auth at the Express mount level, so every guest page load
of Home was 401ing in the background — previously this is what
triggered the hard redirect fixed in the prior two commits. The
ranked-league section is guest-view-unreachable UI regardless (it
only renders in the isAuthenticated branch), so this call should
never have fired for a guest in the first place."
```

---

### Task 5: Audit the other guest-facing pages for the same bug shape

**Files:**
- Verify only: `client/src/pages/TournamentDetail.tsx`, `client/src/pages/TournamentWaitlist.tsx`

- [ ] **Step 1: Re-check TournamentDetail.tsx's data fetching**

Open `client/src/pages/TournamentDetail.tsx` and confirm its `fetchTournament` effect (around line 33-57) only ever calls the authenticated `tournamentsApi.getTournament(id)` when `isAuthenticated` is true, and `tournamentsApi.getTournamentPublic(id)` otherwise — i.e. there is no second, unconditional authenticated call anywhere else in the file the way `Home.tsx`'s `getLeague()` was. Run:

```bash
cd client && grep -n "Api\.\|useApi\|usePaginatedApi" src/pages/TournamentDetail.tsx
```

Expected: every authenticated-only call site (e.g. any admin action handlers) is already gated behind a user action (a button click) guarded by `canManageTournament`/`isTournamentOwner`/`user?.isAdmin`, not something that fires unconditionally on page load for a guest. If anything fires unconditionally and unguarded, note it and treat it as a new bug of the same shape as Task 4 — add a gating fix following the same pattern (`if (!isAuthenticated) return <safe default>;`) plus a regression test, before marking this task done.

- [ ] **Step 2: Re-check TournamentWaitlist.tsx's data fetching**

```bash
cd client && grep -n "Api\.\|useApi\|usePaginatedApi" src/pages/TournamentWaitlist.tsx
```

Expected: same shape — confirm every authenticated-only call is either gated behind `isAuthenticated`/a logged-in-only UI branch, or behind a user-initiated action, with no unconditional on-load authenticated fetch. If one is found, fix it the same way as Task 4 (gate it, add a test asserting the authenticated call isn't made for a guest), before marking this task done.

- [ ] **Step 3: Record the outcome**

If both files check out clean (expected, per the design doc's investigation), no commit is needed for this task — it's a verification step, not a code change. If a fix was required in Step 1 or 2, commit it the same way as Task 4's commit, scoped to just that file.

---

## Self-Review

**Spec coverage:**
- "Replace the global hard-redirect-on-401... with a single callback into AuthContext.logout()" → Tasks 1-2.
- "useRequireAuth... be the only thing that ever navigates to /login" → Task 3 confirms this is already true and now actually exercised.
- "Fix Home.tsx's unconditional getLeague() call" → Task 4.
- "Audit pass... TournamentDetail.tsx and TournamentWaitlist.tsx" → Task 5.
- Scope boundary ("mechanism fix only, no page moves between gated/guest-facing groups") → no task in this plan changes which pages call `useRequireAuth()`.

**Placeholder scan:** No TBD/TODO. Every code step has complete, runnable code, not a description of code.

**Type consistency:** `setUnauthorizedHandler` is defined once in Task 1 (`client/src/services/api.ts`) with signature `(handler: () => void) => void`, and every later reference (Task 1's test, Task 2's `AuthContext.tsx` import and test) uses that exact name and shape. `getLeague`'s new return type (`Promise<ApiResponse<{ league: RankedLeague }> | null>`) is threaded consistently into the `useApi<...>` generic in the same Task 4 edit — no mismatched type left over from the old non-nullable shape.
