# Public User Endpoint Exposes Point Balances, Purchases and Other Private Fields

## State

New

## Summary

`GET /api/users/:id` serializes the entire user document, so any logged-in member can read another member's point balance, lifetime earnings and purchased items (and, from the same code path, fields unrelated to points such as their email and notification list). The profile page also shows any user's balance to any viewer. Whether balances should be public is a product decision, but the endpoint currently exposes them by accident rather than by design, and it violates the project's own rule that endpoints return dedicated response DTOs instead of domain models.

## Problem Details

**File:** `server/src/routes/users.js:634-649`

```js
const user = await User.findById(req.params.id).populate('favoriteTile');
...
res.json({ success: true, data: { user: user.toJSON() } });
```

**File:** `server/src/models/User.js:238-263`

`toJSON` removes only `password` and reset tokens, hides `email` for guests, and (in private mode) hides names and a few profile fields. It does not remove `pointsBalance`, `totalPointsEarned`, `purchasedItems`, `equippedFlair`, `email` (for non-guests), `notifications` or `notificationPreferences`, and the private-mode branch does not strip any of them either.

**File:** `client/src/pages/Profile.tsx:127-130`

`PointsSection` renders for every non-private profile, showing both numbers to any viewer (`client/src/components/profile/PointsSection.tsx:11-32`); `isOwnProfile` only controls the "View history" link.

## Impact

- Members can see exactly how many points others hold, which may or may not be intended (players who spent everything look "poor").
- `purchasedItems` reveals another member's whole inventory through the API even though the UI never shows it.
- Private-mode users still expose their balance, purchases and email through the API, defeating the point of the setting.
- Any new user-level field added later leaks by default.

## Suggested Fix

Decision needed first: what should other members see? Options: (a) lifetime earned only, hide spendable balance and inventory; (b) nothing points-related except the owner's own view; (c) keep both public. Recommended: (a), since lifetime earned reflects play while balance reflects spending.

1. Replace `user.toJSON()` in this route with an explicit response contract (a `UserProfileResponse`-style allowlist), per `.claude/rules/rules.md` DTO guidance. Include the owner-only fields (balance, `purchasedItems`, email, notification settings) only when `req.user._id` matches, or for admins.
2. Make the private-mode behavior consistent: decide what a private profile reveals about flair and points, and enforce it in the contract, not in each component.
3. Update `PointsSection` to render according to the chosen visibility, and add component tests for own vs other profiles.
4. Audit the other user routes that return whole documents (the search routes at `users.js:198` and `:252` already use `.select(...)`; check the rest) and fix the same pattern.
5. Add a route test asserting that a non-owner response contains none of the owner-only fields.

Email and notification exposure is outside the points scope but comes from the same line; fixing the contract fixes both, so confirm with the club that email should not be member-visible.

## Related Files

- `server/src/routes/users.js`
- `server/src/models/User.js`
- `client/src/pages/Profile.tsx`
- `client/src/components/profile/PointsSection.tsx`
- `client/src/services/api.ts`
- `client/src/components/profile/UserInfoSection.tsx`
