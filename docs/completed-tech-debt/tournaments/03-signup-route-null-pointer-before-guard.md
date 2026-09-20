# Signup Route Calls tournament.populate() Before Null Guard

## State

Complete

## Summary

The tournament signup route calls `tournament.populate('createdBy', ...)` immediately after `Tournament.findById(...)` but before the `if (!tournament)` existence check. If `findById` returns null (tournament doesn't exist), the `populate` call throws a TypeError on null, causing a 500 error instead of the intended 404. The server error message leaks stack information rather than returning a clean "Tournament not found" response.

## Problem Details

**File:** `server/src/routes/tournaments.js:1452`

```js
router.post('/:id/signup', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);  // line 1455 — crashes if null

    if (!tournament) {   // line 1457 — too late
      return res.status(404).json({ ... });
    }
```

`tournament` is null when the ID is valid Mongo format but no document exists. Calling `.populate()` on null throws `TypeError: Cannot read properties of null (reading 'populate')`.

## Impact

- Any signup request with a valid but non-existent tournament ID returns a 500 instead of a 404.
- Server logs an uncaught TypeError rather than a controlled error.
- Clients/apps treating 404 and 500 differently (e.g., for user-facing messages) see a misleading response.

## Suggested Fix

Move the `tournament.populate('createdBy', ...)` call to after the null check, or restructure using a single `findById().populate(...)` chain:

```js
const tournament = await Tournament.findById(req.params.id)
  .populate('createdBy', PLAYER_POPULATE_FIELDS);

if (!tournament) {
  return res.status(404).json({ success: false, message: 'Tournament not found' });
}
```

## Related Files

- `server/src/routes/tournaments.js`
