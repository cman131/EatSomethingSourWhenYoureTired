# Round Timer Display Page

## State

Complete

## Summary

There is no dedicated fullscreen timer page for tournament rounds. The round countdown is only visible as inline text inside the "Your Current Round Pairing" card (`CurrentRoundPairing.tsx:165-169`), which is user-specific, small, and only shown to logged-in players currently in a pairing. Tournament organizers need a way to project the countdown on a large monitor or TV so all players can see it at a glance. A new `/round-timer` page driven by `startDate` and `duration` query params would serve this purpose, with the existing inline timer becoming a link that opens the page in a new tab.

## Problem Details

**File:** `client/src/components/tournaments/CurrentRoundPairing.tsx:165-169`

The timer renders as a plain `<span>` — no link, no way to open it fullscreen:

```tsx
{!tournament.isOnline && timeRemaining !== null && (
  <span className={`font-medium ${timeRemaining < 0 ? 'text-red-600' : ''}`}>
    Time: {formatTimeRemaining(timeRemaining)}
  </span>
)}
```

The `round.startDate` and `tournament.roundDurationMinutes` values needed to build a self-contained timer URL are already in scope at this point.

**File:** `client/src/App.tsx:31-64`

All routes are currently wrapped inside a single `<Layout>` component, which renders the site nav and chrome around every page. A fullscreen timer display intended for a large shared screen should render without nav chrome — so the routing setup needs a small restructure to support at least one Layout-free route.

## Impact

- Tournament organizers have no shared countdown display — players must individually check the site on their own devices.
- The inline timer is invisible to anyone not logged in, not signed up, or not in the current round pairing.
- The `App.tsx` route structure will need to be touched to support a fullscreen route regardless of when this is implemented.

## Suggested Fix

1. **Create `client/src/pages/RoundTimer.tsx`** — reads `startDate` (ISO string) and `duration` (integer minutes) from `useSearchParams`. Runs a `setInterval` countdown updating every second. Renders a large centered time display with the tournament name or a generic label. Shows time in red with an overtime indicator when past zero. Requires no authentication and makes no API calls.

2. **Restructure `client/src/App.tsx`** to render `/round-timer` outside the `<Layout>` wrapper. The simplest approach is to move `<Routes>` above `<Layout>` and use a catch-all nested route or a layout route pattern so all existing routes still render inside Layout:

```tsx
<Routes>
  <Route path="/round-timer" element={<RoundTimer />} />
  <Route path="*" element={
    <Layout>
      {/* existing routes as nested Routes */}
    </Layout>
  } />
</Routes>
```

3. **Update `CurrentRoundPairing.tsx:165-169`** — replace the plain timer `<span>` with an `<a>` (or React Router `<Link>` with `target="_blank"`) that builds the URL from `round.startDate` and `tournament.roundDurationMinutes` and opens `/round-timer?startDate=<ISO>&duration=<minutes>` in a new tab. The link text can still show the formatted time remaining so the inline display is unchanged in appearance.

## Related Files

- `client/src/pages/RoundTimer.tsx` *(new file)*
- `client/src/App.tsx`
- `client/src/components/tournaments/CurrentRoundPairing.tsx`
