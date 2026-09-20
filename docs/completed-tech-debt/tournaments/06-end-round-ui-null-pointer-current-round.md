# End Round Button Crashes on Null currentRoundToEnd

## State

Complete

## Summary

In `TournamentDetail`, the `handleEndRound` callback and the `End Round` button label both access `currentRoundToEnd.roundNumber` without first checking that `currentRoundToEnd` is non-null. The `currentRoundToEnd` useMemo can return null (when no started rounds with pairings exist), and the button is conditionally rendered only when `!roundToStart` — it does not guard on `currentRoundToEnd` being defined. If the tournament state transitions such that `currentRoundToEnd` is null at click time, the handler throws a TypeError before making any API call.

## Problem Details

**File:** `client/src/pages/TournamentDetail.tsx:237`

```ts
const handleEndRound = async () => {
  if (!id || !currentRoundToEnd.roundNumber) return;  // crashes if currentRoundToEnd is null
```

The guard checks `!currentRoundToEnd.roundNumber` but not `!currentRoundToEnd` itself.

**File:** `client/src/pages/TournamentDetail.tsx:555`

```tsx
{!roundToStart && (
  <button onClick={handleEndRound} ...>
    {actionLoading ? 'Ending...' : (tournament && currentRoundToEnd ? `End ${getRoundLabel(...)}` : 'End Round')}
  </button>
)}
```

The button is shown when `!roundToStart`, but `currentRoundToEnd` may still be null (no started round exists). Clicking would hit the handler and crash at the property access before reaching the API call.

**File:** `client/src/pages/TournamentDetail.tsx:96`

```ts
const currentRoundToEnd = React.useMemo(() => {
  // ...
  if (roundsWithPairings.length === 0) {
    return null;  // can return null
  }
  // ...
}, [tournament]);
```

## Impact

- Clicking "End Round" when `currentRoundToEnd` is null throws `TypeError: Cannot read properties of null` in the browser, crashing the component.
- The error is surfaced as an unhandled exception rather than a user-facing message.
- This edge case can occur during rapid state transitions (e.g., a round is ended by another admin session and the current user's local state hasn't refreshed yet).

## Suggested Fix

1. Add an explicit null guard at the top of `handleEndRound`:
   ```ts
   if (!id || !currentRoundToEnd) return;
   ```
2. Also guard the button render condition to only show the button when `currentRoundToEnd` is non-null:
   ```tsx
   {!roundToStart && currentRoundToEnd && (
     <button ...>
   ```

## Related Files

- `client/src/pages/TournamentDetail.tsx`
