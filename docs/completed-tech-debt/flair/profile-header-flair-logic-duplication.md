# Profile Header Flair Logic Duplication

## State

Complete

## Summary

`UserInfoSection` (the profile page header) renders flair — name color class, name icon, and title badge — with its own inline JSX rather than delegating to a shared abstraction. `UserDisplay` owns the canonical flair rendering path and houses a `TitleBadge` sub-component that handles both standard and premium titles. Because `UserInfoSection` duplicates this logic independently, any future change to how flair renders (new premium title styles, icon sizing, badge appearance) must be applied in two places or the profile header will silently drift out of sync.

## Problem Details

**File:** `client/src/components/user/UserDisplay.tsx:98–116`

`UserDisplay` owns a `TitleBadge` component and a `PREMIUM_TITLES` set that routes to `getPremiumTitleClass`/`getPremiumTitleEmoji` for special styling:

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

**File:** `client/src/components/profile/UserInfoSection.tsx:104–117`

`UserInfoSection` re-implements flair rendering inline, but uses a hardcoded standard-badge style for the title — it never calls `getPremiumTitleClass` or `getPremiumTitleEmoji`, so premium titles render incorrectly on the profile header:

```tsx
<h3 className={`text-3xl font-bold text-gray-900 ${user?.equippedFlair?.nameColor || ''}`}>
  {user?.equippedFlair?.nameIcon && (
    <span className="mr-2 text-2xl" aria-hidden="true">{user.equippedFlair.nameIcon}</span>
  )}
  {user?.displayName}
</h3>
{user?.equippedFlair?.title && (
  <span
    data-testid="flair-title-badge"
    className="mt-1 inline-block px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full"
  >
    {user.equippedFlair.title}
  </span>
)}
```

## Impact

- Premium title holders (Chicken Farmer, Chombo Chaser) see their title badge without the correct color/emoji on their own profile page header.
- Every future flair change (new premium title, badge restyling) requires two edits — one in `UserDisplay`, one in `UserInfoSection` — with no compile-time enforcement.
- The profile header is the most prominent place a user sees their own flair, making the inconsistency especially visible.

## Suggested Fix

1. Export `TitleBadge` from `UserDisplay.tsx` (or move it to its own file under `client/src/components/user/`).
2. Replace the inline title `<span>` in `UserInfoSection.tsx` (lines 110–117) with `<TitleBadge value={user.equippedFlair.title} />`.
3. Verify the name color and icon rendering in `UserInfoSection` still uses the same class/sizing conventions as `UserDisplay` — adjust if they've diverged.
4. Add or update the `UserInfoSection` test to assert premium title badges render with their special class.

## Related Files

- `client/src/components/user/UserDisplay.tsx`
- `client/src/components/profile/UserInfoSection.tsx`
- `client/src/components/profile/UserInfoSection.test.tsx`
- `client/src/utils/flairUtils.ts`
