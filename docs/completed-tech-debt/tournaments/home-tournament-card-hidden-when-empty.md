# Home Page Tournaments Card Hidden When No Upcoming Tournament

## State

Complete

## Summary

On the authenticated home page, the tournament card is conditionally rendered only when an upcoming tournament exists. When there is none, the card disappears entirely but the "Tournaments" section header label remains — visually orphaned and immediately above the Ranked League card, making the label appear to belong to that card instead. The fix is to always render a tournaments card, showing a "No upcoming tournaments" placeholder message when the list is empty.

## Problem Details

**File:** `client/src/pages/Home.tsx:74`

The tournament card is gated behind `{nextTournament && (...)}`:

```tsx
<div className="space-y-3">
  {nextTournament && (           // ← card disappears entirely when null
    <div className="card">
      ...
    </div>
  )}
  <div className="card flex items-center justify-between">
    {/* Ranked League card */}
  </div>
</div>
```

When `nextTournament` is `null`, the "Tournaments" heading at line 69 has no card beneath it. The Ranked League card (line 100) becomes the first visible card under that heading, making it look like the ranked league is a tournament section item rather than its own section.

## Impact

- The "Tournaments" section label is visually misattributed to the Ranked League card, confusing the layout hierarchy.
- Users have no indication of whether the absence of a tournament card means "no upcoming tournaments" or whether the section failed to load.
- The Ranked League card is effectively unlabeled by its own section heading when tournaments are absent.

## Suggested Fix

1. Remove the `{nextTournament && (...)}` conditional wrapper from the tournament card.
2. Always render a card in the tournaments slot.
3. Inside the card, branch on `nextTournament`:
   - If present: render the existing tournament name, date, location, and "View details →" link.
   - If absent: render a short placeholder — e.g., `"No upcoming tournaments"` in muted text.
4. Keep the Ranked League card as a separate section (with its own heading) rather than a sibling card inside the tournaments `space-y-3` container — see the related ranked-league plan for that work.

## Related Files

- `client/src/pages/Home.tsx`
