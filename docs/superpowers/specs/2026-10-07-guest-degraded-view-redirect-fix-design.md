# Design: Stop API-Layer Redirects From Hijacking Guest-Facing Pages

## Problem

Pages that are supposed to offer a degraded view to logged-out visitors — `Home.tsx`,
`TournamentsList.tsx`, `TournamentDetail.tsx`, `TournamentWaitlist.tsx` — sometimes bounce a guest
to `/login` anyway, even though none of them contain a page-level redirect. The redirect isn't
coming from the page; it's coming from the API layer.

`apiRequest()` in `client/src/services/api.ts` treats *any* `401` from *any* call, on *any* page,
as grounds for an immediate hard navigation:

```ts
if (response.status === 401) {
  if (window.location.pathname === '/login') { throw new Error('Unauthorized'); }
  const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
  window.location.href = loginUrl;
  throw new Error('Unauthorized - redirecting to login');
}
```

This fires as a side effect of `window.location.href` *before* the calling code's `try/catch` ever
runs, so a page has no opportunity to treat the failure as "this optional section has no data" —
the browser is already navigating away.

### Root cause, confirmed in code

`Home.tsx` calls `rankedLeaguesApi.getCurrent()` (`GET /api/ranked-leagues/current`)
unconditionally on every render, including for guests:

```ts
const getLeague = React.useCallback(() => rankedLeaguesApi.getCurrent(), []);
const { data: leagueResponse, loading: leagueLoading } = useApi(getLeague);
```

Unlike the adjacent `getGames()` callback (lines 38-49 of `Home.tsx`), which already checks
`isAuthenticated` and short-circuits to an empty result for guests, `getLeague()` has no such
guard — even though its result is only ever rendered in the `isAuthenticated` branch of the
component.

`/api/ranked-leagues` is mounted with `authenticateToken` applied to the whole router
(`server.js:91`: `app.use('/api/ranked-leagues', authenticateToken, rankedLeagueRoutes)`), so this
call always 401s for a guest. That 401 is what triggers the hard redirect — not anything in
`Home.tsx` itself.

`TournamentsList.tsx`'s own data call (`GET /api/tournaments`) hits `router.get('/', ...)` in
`tournaments.js`, which has no `authenticateToken` — it's already public. No equivalent bug was
found there in the current code; it's included in this fix as a guest-facing page because the same
class of bug (an unconditional authenticated call added later) could reintroduce the same failure
mode on it undetected, since nothing today would stop it.

## Scope

This is a mechanism fix only. The current split between fully-gated pages and guest-facing pages
is not being reconsidered:

- **Fully gated (redirect on page load is correct, unchanged):** `Profile`, `GamesList`,
  `GameDetail`, `GameSubmission`, `MembersList`, `Points`, `Shop`, `RankedLeague`,
  `AdminPointsAdjustment`, `TournamentSubmission`, `TournamentGamesAdmin`,
  `TournamentGameSubmission`, `DiscardQuiz`, `DecisionQuiz` — all via `useRequireAuth()`.
- **Guest-facing (must never be yanked away by a background call):** `Home`, `TournamentsList`,
  `TournamentDetail`, `TournamentWaitlist`.

Whether any of the first group *should* move to the second group is explicitly out of scope for
this change.

## Design

Redirects become exclusively a page-level concern, driven by `AuthContext`'s `isAuthenticated`
state. The API layer no longer navigates anywhere; it just reports failure like any other error.

### `client/src/services/api.ts`

Remove the `window.location.href` branch. Add a module-level, settable hook so another part of the
app can be told "the current session just became invalid," without `api.ts` importing
`AuthContext` (avoids a circular import, since `AuthContext.tsx` already imports from `api.ts`):

```ts
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};
```

In `apiRequest()`'s 401 branch:

```ts
if (response.status === 401) {
  onUnauthorized?.();
  throw new Error('Unauthorized');
}
```

No special-casing of `window.location.pathname === '/login'` is needed anymore — there's no
navigation here to loop on.

### `client/src/contexts/AuthContext.tsx`

On mount, wire the existing `logout()` function in as the handler:

```ts
useEffect(() => {
  setUnauthorizedHandler(logout);
}, []);
```

`logout()` already does exactly what's needed: clears `authToken` from `localStorage`, nulls
`token` and `user`. No new state is introduced — `isAuthenticated` already derives as
`!!user && !!token`, so it flips to `false` the instant any call 401s, regardless of which page
triggered it.

### `client/src/hooks/useRequireAuth.ts`

No code change. It already has:

```ts
useEffect(() => {
  if (!authLoading && !isAuthenticated) {
    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
  }
}, [isAuthenticated, authLoading, ...]);
```

Because this effect's dependency array includes `isAuthenticated`, it was already capable of
reacting to a *mid-session* auth loss, not just the initial-load case — it just never got the
chance before, because the API layer's hard redirect won the race every time. After this change,
a token expiring while a user is active on a gated page now produces the same `?redirect=` flow as
today's page-load case, except via client-side `navigate()` instead of a full page reload — a
minor UX improvement (SPA state like in-progress form inputs on `GameSubmission` isn't nuked by a
hard navigation) that falls out of this change rather than something separately built.

### `client/src/pages/Home.tsx`

Fix the actual bug. Gate `getLeague()` the same way `getGames()` already is:

```ts
const getLeague = React.useCallback(() => {
  if (!isAuthenticated) {
    return Promise.resolve({ success: true, data: { league: null } });
  }
  return rankedLeaguesApi.getCurrent();
}, [isAuthenticated]);
```

`league` is already derived as `leagueResponse?.data?.league ?? null`, and every downstream value
(`isRegistered`, `userEntry`, `daysRemaining`, `rankedPlayers`, `userRank`) already null-checks
`league` — so a `null` league from this stub flows through exactly like the "still loading" case
does today. The ranked-league UI block is only rendered inside the `isAuthenticated` branch, so a
guest never sees any effect of this change beyond "the background call no longer fires."

### Audit pass (verification, not expected to require changes)

Confirm `TournamentDetail.tsx` and `TournamentWaitlist.tsx` make no other unconditional
authenticated-only call outside their already-correct `isAuthenticated ? privateEndpoint :
publicEndpoint` branches. (`TournamentDetail.tsx`'s single data fetch was already read during
investigation and is correctly branched; `TournamentWaitlist.tsx` needs the same confirmation
during implementation.)

## Data Flow

No server or route changes. No new client state. The only state that changes meaning is
`AuthContext.isAuthenticated`: today it can only transition `false → true` (login) or `true →
false` (explicit logout, or failed init-time profile fetch); after this change it can also
transition `true → false` as a side effect of any 401 encountered anywhere in the app, surfaced
through the same `logout()` path.

## Edge Cases

- **Guest loads Home:** `getLeague()` never fires an authenticated request; `getGames()` already
  didn't. No 401s occur from Home's own data fetching. Guest view renders as today.
- **Logged-in user's token expires while idle on Home:** next background refetch of `getGames()`
  or `getLeague()` 401s → `logout()` fires → `isAuthenticated` flips false → `Home` re-renders its
  existing guest-view branch. No redirect occurs (Home has no `useRequireAuth`), which is correct:
  Home is guest-viewable, so losing auth there should degrade, not redirect — matching the
  Problem statement's intent.
- **Logged-in user's token expires while on a gated page (e.g. `GameSubmission`):** the next
  authenticated call 401s → `logout()` fires → `isAuthenticated` flips false →
  `useRequireAuth`'s effect fires → client-side `navigate('/login?redirect=/submit-game')`. Same
  outcome as today, minus the full page reload.
- **Already on `/login` when a stray 401 occurs:** previously specialcased in `api.ts`; no longer
  needed since nothing navigates from `api.ts` at all. `Login.tsx` has no `useRequireAuth`, so
  nothing redirects it away from itself.
- **Multiple concurrent 401s** (e.g. Home's `getGames()` and `getLeague()` both fail in the same
  tick for a just-expired session): `logout()` is idempotent (nulling already-null state, removing
  an already-removed localStorage key), so calling it more than once in quick succession is safe.

## Testing

**Client**
- `api.test.ts` (or wherever `apiRequest` is currently covered): a 401 response no longer sets
  `window.location.href`; it throws `Error('Unauthorized')` and, when a handler is registered via
  `setUnauthorizedHandler`, invokes it exactly once per failed call.
- `AuthContext.test.tsx`: registers `logout` as the unauthorized handler on mount; a simulated
  invocation clears `user`/`token` and removes `authToken` from `localStorage`, flipping
  `isAuthenticated` to `false`.
- `useRequireAuth.test.ts` (or the hook's existing test file): add a case where `isAuthenticated`
  starts `true` and transitions to `false` after mount (not just starting `false`) — asserts
  `navigate` is called with the same `?redirect=` shape as the already-covered initial-load case.
- `Home.test.tsx`: guest render triggers no call to `rankedLeaguesApi.getCurrent()`
  (mock/spy assertion), mirroring the existing coverage for `gamesApi.getGames()`.
- Regression check across the 14 gated pages' existing tests: none of them assert on
  `window.location.href` directly (grep during implementation to confirm), since that behavior is
  being removed.

## Non-Goals

- Reconsidering which pages are fully gated vs. guest-facing (explicitly deferred — see Scope).
- Any change to token refresh (`POST /api/auth/refresh-token` exists as a manual API method today
  and is not wired into `apiRequest`'s retry path; out of scope here).
- Any server-side route/middleware changes.
- A route-level auth guard (e.g. a `ProtectedRoute` wrapper) to replace the current per-page
  `useRequireAuth()` calls — the per-page pattern is kept as-is; only the API-layer redirect is
  removed.
