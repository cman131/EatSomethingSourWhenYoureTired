# Home Page Ranked League Card Shows No User Status

## State

Complete

## Summary

The Ranked League card on the authenticated home page (`Home.tsx:100–108`) displays only a generic "Current Season" label. It does not tell the user whether they are registered, how many qualifying games they have completed, where they rank on the leaderboard, or how many days remain in the season. All the data and logic needed to compute this already exists in `RankedLeague.tsx`. The home page card should surface the user's personal status at a glance, prompting registration or celebrating progress without requiring a page navigation.

## Problem Details

**File:** `client/src/pages/Home.tsx:100`

The current card is entirely static:

```tsx
<div className="card flex items-center justify-between">
  <div>
    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ranked League</div>
    <div className="font-semibold text-gray-900">Current Season</div>
  </div>
  <Link to="/ranked" className="text-sm text-primary-600 font-semibold hover:text-primary-700">
    View →
  </Link>
</div>
```

The relevant logic already lives in `RankedLeague.tsx` and can be reused:

- **Threshold**: `RANKED_GAMES_THRESHOLD = 6` (`RankedLeague.tsx:9`)
- **Registration check**: `league.players.some(p => p.player._id === user._id)` (`RankedLeague.tsx:49–51`)
- **Days remaining**: `Math.max(0, 90 - Math.floor((Date.now() - new Date(league.startDate).getTime()) / (1000 * 60 * 60 * 24)))` (`RankedLeague.tsx:53–55`)
- **Ranked position**: index in `league.players.filter(p => p.gamesPlayed >= 6).sort((a, b) => b.rankedPoints - a.rankedPoints)` (`RankedLeague.tsx:57–61`)
- **API call**: `rankedLeaguesApi.getCurrent()` returning `{ league: RankedLeague }` (`RankedLeague.tsx:27–28`)

The home page makes no call to `rankedLeaguesApi`, so it cannot show any of this.

## Impact

- Users cannot tell at a glance whether they are registered, qualifying, or ranked without navigating away.
- Unregistered users get no prompt to join from the home page.
- Qualifying users see no progress toward the 6-game threshold.
- Ranked users see no position, making the home page feel disconnected from their league progress.
- Days remaining is only visible on the dedicated Ranked League page.

## Suggested Fix

1. Add a `rankedLeaguesApi.getCurrent()` call on the authenticated home page (via `useApi` consistent with how `getTournaments` is fetched at `Home.tsx:22–26`).
2. Derive the following from the league response and `user._id`:
   - `isRegistered`: whether the user appears in `league.players`
   - `userEntry`: the `RankedLeaguePlayer` for the current user (if present)
   - `daysRemaining`: using the same formula as `RankedLeague.tsx:53–55`
   - `userRank`: 1-based index of the user in the sorted ranked players list (only when `gamesPlayed >= 6`)
3. Replace the static "Current Season" text with a status line based on these three states:
   - **Not registered**: `"Not registered"` + a `"Join →"` link to `/ranked`
   - **Qualifying** (`gamesPlayed < 6`): `"Qualifying — X / 6 games complete"`
   - **Ranked** (`gamesPlayed >= 6`): `"Ranked — #N · X games played"`
4. Add a `"X days remaining"` sub-line beneath the status in all three states (hide if `league` failed to load).
5. Keep the existing `"View →"` link to `/ranked`.
6. Handle the loading state gracefully — show the existing static card text until the API call resolves rather than flashing a skeleton.

## Related Files

- `client/src/pages/Home.tsx`
- `client/src/pages/RankedLeague.tsx`
- `client/src/services/api.ts` (`rankedLeaguesApi`, `RankedLeague`, `RankedLeaguePlayer` types)
