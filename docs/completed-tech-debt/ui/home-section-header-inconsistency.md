# Home Page Section Header Inconsistency

## State

Complete

## Summary

The authenticated home page has three content sections — Tournaments, Ranked League, and Recent Games — but only two of them (Tournaments and Recent Games) follow the established header pattern: a bold `h2` above the card with a "View all →" link. The Ranked League status card is instead nested as a second card inside the Tournaments section and uses a small grey uppercase label inside the card body in place of a proper section header. This visual inconsistency makes Ranked League feel like a sub-item of Tournaments rather than a peer section, which misrepresents the feature's importance.

## Problem Details

**File:** `client/src/pages/Home.tsx:97-171`

The Tournaments section wraps two sibling cards in a single `div`. The first is the tournament card (lines 106–134); the second is the Ranked League status card (lines 135–169). The Ranked League card has only a grey `text-xs` label inside it:

```tsx
{/* Tournaments — lines 97-171 */}
<div>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-lg font-bold text-gray-900">Tournaments</h2>
    <Link to="/tournaments" …>View all →</Link>
  </div>
  <div className="space-y-3">
    <div className="card">…tournament info…</div>

    {/* Ranked League card — visually a sibling of the tournament card, nested here */}
    <div className="card flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ranked League</div>
        {/* status content */}
      </div>
      <Link to="/ranked">View →</Link>
    </div>
  </div>
</div>
```

By contrast, Recent Games (lines 173–272) follows the correct pattern:

```tsx
<div>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-lg font-bold text-gray-900">Recent Games</h2>
    <Link to="/games" …>View all →</Link>
  </div>
  <div className="card">…</div>
</div>
```

## Impact

- Ranked League appears visually subordinate to Tournaments, even though it is an independent feature area
- Section headers on the authenticated home page are inconsistent, undermining the page's visual hierarchy
- The "View →" link inside the Ranked League card is stylistically different from the "View all →" links in the Tournaments and Recent Games section headers

## Suggested Fix

1. Extract the Ranked League card (lines 135–169) out of the Tournaments section into its own sibling `<div>` section, placed between Tournaments and Recent Games.
2. Add a section header using the established pattern:
   ```tsx
   <div className="flex items-center justify-between mb-3">
     <h2 className="text-lg font-bold text-gray-900">Ranked League</h2>
     <Link to="/ranked" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
       View all →
     </Link>
   </div>
   ```
3. Remove the grey `text-xs text-gray-400 uppercase tracking-wide` "Ranked League" label from inside the card body — the section header replaces it.
4. Remove the `<Link to="/ranked">View →</Link>` from inside the card — it moves to the section header.
5. Wrap the card body in a plain `<div className="card">` without the `flex items-center justify-between` layout that was only needed to accommodate the inline "View →" link.

## Related Files

- `client/src/pages/Home.tsx`
