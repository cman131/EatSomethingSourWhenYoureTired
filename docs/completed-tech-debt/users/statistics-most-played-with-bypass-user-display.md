# Statistics "Most Played With" Bypasses UserDisplay

## State

Complete

## Summary

The "Most Played With" section in `StatisticsSection` renders each player as a hand-rolled `UserAvatar` + `<span>` combination — duplicating link/private-mode branching logic and omitting flair entirely. `UserDisplay` already handles all of this: avatar, display name, private mode suppression, profile link, name color, name icon, and title badge. Bypassing it means players shown in this stat row never reflect equipped flair, and any future change to how players are displayed (e.g. guest indicators, new flair types) won't apply here automatically.

## Problem Details

**File:** `client/src/components/profile/StatisticsSection.tsx:155–181`

The component manually branches on `privateMode` and renders its own avatar + name markup in both paths:

```tsx
{mostPlayedWith.map((player) => (
  player.privateMode ? (
    <div key={player._id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-md">
      <UserAvatar user={player} size="xs" className="w-6 h-6" />
      <span className="text-sm font-medium text-gray-900">{player.displayName}</span>
    </div>
  ) : (
    <Link key={player._id} to={`/profile/${player._id}`} className="...">
      <UserAvatar user={player} size="xs" className="w-6 h-6" />
      <span className="text-sm font-medium text-gray-900">{player.displayName}</span>
    </Link>
  )
))}
```

`UserDisplay` already encapsulates exactly this branching (`showLink` is suppressed when `isPrivate || isGuest`), renders the avatar, applies flair name color/icon, and shows the title badge.

## Impact

- Players with equipped flair appear without name color, name icon, or title badge in the "Most Played With" row — inconsistent with every other player list in the app.
- The private-mode and link-suppression branching is duplicated from `UserDisplay`, creating a second place that must be kept in sync if that logic changes.
- Guest player handling (`isGuest`) is not accounted for at all in the current code.

## Suggested Fix

1. Replace the entire `mostPlayedWith.map(...)` block (lines 155–182) with a single `<UserDisplay>` per player:
   ```tsx
   {mostPlayedWith.map((player) => (
     <UserDisplay key={player._id} user={player} size="sm" showLink={true} />
   ))}
   ```
2. Confirm `player` objects returned by the API include `equippedFlair` — add it to the population/select in the relevant server route if not already present.
3. Remove the now-unused `Link` import from `StatisticsSection.tsx` if it is no longer needed elsewhere in the file.
4. Add a test asserting that a player with `equippedFlair` renders their name color class inside the "Most Played With" section.

## Related Files

- `client/src/components/profile/StatisticsSection.tsx`
- `client/src/components/user/UserDisplay.tsx`
- `server/src/routes/users.js` (verify `equippedFlair` is populated on the most-played-with query)
