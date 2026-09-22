# Admin Points Adjustment UI — Design

## Problem

`POST /api/points/admin/adjust` (`server/src/routes/points.js`) already lets an admin adjust a
user's points balance with a required reason, backed by `adjustPoints()`
(`server/src/utils/pointsService.js`) and validated by `validateAdminAdjustment`
(`server/src/middleware/validation.js`: `userId` must be a Mongo ID, `amount` a non-zero integer,
`reason` required and ≤500 chars). There is no client-side caller for this endpoint and no UI — an
admin currently has to hit the API directly (curl/Postman).

## Decisions

| Question | Decision |
|----------|----------|
| Where does the UI live | New standalone page at `/admin/points` |
| How is a user selected | Debounced name search (same pattern as `AddPlayerModal.tsx`) against the existing `usersApi.searchUsers`; can also be pre-selected via `?userId=` query param |
| Entry point into the page | An "Adjust Points" link on `Profile.tsx`, shown only when the viewer is an admin, linking to `/admin/points?userId=<profileUserId>`. No nav/navbar link in `Layout.tsx`. |
| Balance shown on the page | Current balance only, fetched via `usersApi.getUser(userId)` (search results don't include `pointsBalance`; the profile route does for owner/admin viewers per `userProfileContract.js`) |
| Amount preview | Admin types a signed non-zero integer delta directly (matches the API's existing shape); no client-side "resulting balance" preview to avoid drifting from server truth |
| Adjustment history on this page | None — the user's own `/points` page already shows their full transaction history; not duplicated here |
| Non-admin visiting `/admin/points` directly | Redirected to `/` via `<Navigate to="/" replace />` |
| Display label for `admin_adjustment` transactions | Changed to "Deus Ex Machina" in `POINT_TYPE_LABELS` (`Points.tsx`) — **label only**, the stored `PointTransaction.type` enum value (`admin_adjustment`) is unchanged everywhere else (model, `pointsService.js`, `pointsReconciliation.js`, `pointsHistoryContext.js`, tests) |

## Design

### `client/src/services/api.ts`

Add one method to the existing `pointsApi` object:

```ts
adjustBalance: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
  return apiRequest<ApiResponse<{ message: string }>>('/points/admin/adjust', {
    method: 'POST',
    body: JSON.stringify({ userId, amount, reason }),
  });
},
```

Relies on the existing `apiRequest` error handling (throws with the server's `message` on non-2xx),
same as every other method in this file.

### `client/src/pages/AdminPointsAdjustment.tsx` (new)

Route: `/admin/points` (registered in `App.tsx` alongside the other authenticated routes).

- `useRequireAuth()`, then `const { user } = useAuth()`. If `!user?.isAdmin`, render
  `<Navigate to="/" replace />` — no admin-only content ever mounts for a non-admin.
- Reads `userId` from `useSearchParams()`.
  - If present: fetch that user immediately via `usersApi.getUser(userId)` and skip the search UI.
  - If absent: render the search box.
- **Search state** (mirrors `AddPlayerModal.tsx`'s debounce pattern, inline instead of in a modal):
  text input → 300ms debounce → `usersApi.searchUsers(term, 20)` → list of results rendered with
  `UserDisplay`; clicking a result selects that user.
- **Selected-user state**: once a user is selected (via search click or `?userId=`), fetch
  `usersApi.getUser(userId)` and display `UserDisplay` + current `pointsBalance`. A "change user"
  control clears the selection and returns to search (only relevant when there was no `?userId=`
  deep link, or the admin wants to switch targets).
- **Adjustment form** (visible once a user is selected):
  - Amount: numeric input, must parse to a non-zero integer (client-side check mirrors the server's
    `isInt` + `!== 0` rule so obviously-invalid submissions never round-trip).
  - Reason: required textarea, max 500 chars (client-side `maxLength`, matching the server limit).
  - Submit button disabled while submitting, or while amount/reason are invalid.
- **On submit**: call `pointsApi.adjustBalance`. On success: show a success banner ("Adjustment
  recorded"), re-fetch the selected user's balance so the card updates, clear the amount/reason
  fields, keep the user selected. On failure: show the thrown error's message in an inline banner
  (covers the server's 404 "User not found", 400 "Adjustment would drop the balance below zero", and
  generic 500 text); form values are preserved so the admin can correct and retry.
- Loading and error states throughout follow the existing pattern used in `Points.tsx` /
  `TournamentGamesAdmin.tsx` (inline text/skeletons, no spinner library).

### `client/src/pages/Profile.tsx`

In the header block (near `isOwnProfile ? 'Profile' : ...`), add:

```tsx
{currentUser?.isAdmin && (
  <Link to={`/admin/points?userId=${profileUserId}`} className="btn-secondary">
    Adjust Points
  </Link>
)}
```

Shown for any profile an admin views, including their own — no special-casing needed since the
standalone page's search flow already permits that.

### `client/src/pages/Points.tsx`

One-line change:

```ts
admin_adjustment: 'Deus Ex Machina',
```

(was `'Admin Adjustment'`). Purely cosmetic — the underlying `PointTransaction.type` string stays
`admin_adjustment`.

### `client/src/App.tsx`

Add `<Route path="/admin/points" element={<AdminPointsAdjustment />} />` alongside the other
authenticated routes (e.g. near `/tournaments/:id/games`).

## Testing

Jest + React Testing Library, `npm test -- --watchAll=false`, queried via `getByRole`/`getByLabelText`
per `rules.md`.

`AdminPointsAdjustment.test.tsx`:
- Non-admin visiting the route is redirected (no admin content renders).
- Admin with no `?userId=` sees the search box; typing a name debounces and calls `searchUsers`,
  renders results.
- Selecting a search result fetches and displays that user's balance.
- Admin with `?userId=<id>` skips search and loads that user's balance directly.
- Submitting a valid amount + reason calls `pointsApi.adjustBalance`, shows a success message, and
  the displayed balance updates (re-fetch reflected).
- Amount of `0` or an empty reason keeps submit disabled / blocks submission client-side.
- A server error (e.g. insufficient balance) surfaces the returned message and preserves form input.

`Profile.test.tsx`:
- "Adjust Points" link is present when `currentUser.isAdmin` is true, absent otherwise, and points to
  `/admin/points?userId=<profileUserId>`.

No backend changes, so no new server tests — `POST /api/points/admin/adjust` and its validation are
already covered by `server/src/routes/points.test.js`.

## Files

- `client/src/services/api.ts` (add `pointsApi.adjustBalance`)
- `client/src/pages/AdminPointsAdjustment.tsx` (new)
- `client/src/pages/__tests__/AdminPointsAdjustment.test.tsx` (new)
- `client/src/pages/Profile.tsx` (add admin-only "Adjust Points" link)
- `client/src/pages/__tests__/Profile.test.tsx` (add link visibility case)
- `client/src/pages/Points.tsx` (relabel `admin_adjustment` → "Deus Ex Machina")
- `client/src/App.tsx` (register `/admin/points` route)
