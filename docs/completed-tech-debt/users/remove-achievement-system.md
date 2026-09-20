# Remove Achievement System

## State

Complete

## Summary

The achievement system — a large bank of gameplay milestones tracked across a complex 1,447-line service — has never gained traction with players. Every profile page load triggers `GET /api/achievements/user/:userId`, which runs sequential per-user stat calculations across all verified games, quizzes, and tournaments for every achievement definition. With zero player engagement, this is dead weight: expensive computation, substantial code surface, and a navigation entry (Community > Achievements) that players ignore. The entire subsystem should be removed cleanly before the new points system is built in its place.

## Problem Details

**File:** `server/src/utils/achievementService.js:1–1447`

The core service (`achievementService.js`) is 1,447 lines. The key bottleneck is `resolveAllAchievements`, which calls `resolveAchievementV2` for each achievement, and each of those calls `calculateUserStats` (which queries `Game`, `DiscardQuiz`, `Tournament` in series) plus, for grand achievements, `getLeaderboardValues` (which calls `calculateUserStats` for *every user* in the system):

```js
// achievementService.js:888-905 — leaderboard computation iterates all users
for (const user of allUsers) {
  const stats = await calculateUserStats(user._id); // full DB scan per user
  ...
}
```

This runs on every profile page visit via the route at `server/src/routes/achievements.js:53`:

```js
const results = await resolveAllAchievements(userId, { includeLeaderboard: true });
```

**File:** `client/src/components/profile/AchievementsSection.tsx:1–161`

Renders on every profile page, unconditionally fires the expensive API call. Players who have earned nothing see a "No achievements earned yet" placeholder with no clear call to action.

**File:** `client/src/components/Layout.tsx:44–46`

```ts
const communityLinks = isAuthenticated ? [
  { name: 'Games', href: '/games', icon: ChartBarIcon },
  { name: 'Achievements', href: '/achievements', icon: FaMedal },
] : [];
```

The Achievements link occupies nav real estate under Community for every logged-in user.

**File:** `client/src/App.tsx:16,51`

```tsx
import AchievementsList from './pages/AchievementsList';
// ...
<Route path="/achievements" element={<AchievementsList />} />
```

**File:** `server/src/server.js:15,89`

```js
const achievementRoutes = require('./routes/achievements');
// ...
app.use('/api/achievements', authenticateToken, achievementRoutes);
```

## Impact

- Every profile page load fires an expensive multi-query API call that no player is waiting for
- ~1,650 lines of server code (model + service + routes) maintained with no usage
- ~400 lines of client code (list page + profile section) maintained with no usage
- Navigation link persists for all logged-in users, pointing to an unused page
- Adding the new points system becomes cleaner without the achievement infrastructure creating confusion about which gamification layer to extend

## Suggested Fix

Delete server files:
1. `server/src/models/Achievement.js`
2. `server/src/utils/achievementService.js`
3. `server/src/routes/achievements.js`

Update `server/src/server.js`:
4. Remove `const achievementRoutes = require('./routes/achievements');` (line 15)
5. Remove `app.use('/api/achievements', authenticateToken, achievementRoutes);` (line 89)

Delete client files:
6. `client/src/pages/AchievementsList.tsx`
7. `client/src/components/profile/AchievementsSection.tsx`

Update `client/src/App.tsx`:
8. Remove `import AchievementsList from './pages/AchievementsList';` (line 16)
9. Remove `<Route path="/achievements" element={<AchievementsList />} />` (line 51)

Update `client/src/components/Layout.tsx`:
10. Remove the `{ name: 'Achievements', href: '/achievements', icon: FaMedal }` entry from `communityLinks` (lines 44–46); remove the unused `FaMedal` import (line 20)

Update `client/src/services/api.ts`:
11. Remove the `achievementsApi` export, the `Achievement` interface, and the `UserAchievement` interface

Update the Profile page:
12. Remove the `<AchievementsSection />` render and its import from whichever profile component uses it (likely `client/src/pages/Profile.tsx`)

Run the test suite to confirm nothing references the deleted exports.

## Related Files

- `server/src/models/Achievement.js`
- `server/src/utils/achievementService.js`
- `server/src/routes/achievements.js`
- `server/src/server.js`
- `client/src/pages/AchievementsList.tsx`
- `client/src/components/profile/AchievementsSection.tsx`
- `client/src/App.tsx`
- `client/src/components/Layout.tsx`
- `client/src/services/api.ts`
- `client/src/pages/Profile.tsx`
