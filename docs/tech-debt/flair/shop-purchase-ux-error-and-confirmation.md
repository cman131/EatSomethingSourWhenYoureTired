# Shop Purchase UX: Server Errors Are Hidden and There Is No Confirmation Step

## State

InProgress

## Summary

Purchases are permanent (there is no refund or sell-back today), but the Shop buys an item on a single click with no confirmation. When the purchase fails, the page shows a fixed "Purchase failed. Please try again." for every cause, including "You already own this item" and "Insufficient points balance", and telling a user to retry an error that cannot succeed. The Buy button also stays enabled while the request is in flight, which makes accidental double-purchases easy to trigger.

## Problem Details

**File:** `client/src/pages/Shop.tsx:59-69`

```tsx
const handlePurchase = async (item: ShopItem) => {
  setActionError(null);
  setActionSuccess(null);
  try {
    await shopApi.purchase(item._id);
    setActionSuccess(`Purchased ${item.name}!`);
    refreshInventory();
  } catch {
    setActionError('Purchase failed. Please try again.');
  }
};
```

The caught error is ignored. The server returns specific messages (`server/src/routes/shop.js:64-70`), but they never reach the user. The same applies to `handleEquip` (`:71-83`).

**File:** `client/src/pages/Shop.tsx:239-245`

The Buy button is disabled only when the known balance is too low; it is not disabled while `handlePurchase` is pending, and there is no confirm step before spending.

**File:** `client/src/pages/Shop.tsx:132-141`

Success and error banners are plain `div`s without `role="status"` or `role="alert"`, so screen readers do not announce them.

## Impact

- Users get misleading advice on failures that a retry cannot fix.
- One accidental click permanently spends up to 300 points on a cosmetic.
- Double clicks send concurrent requests, which the current server handles badly (see `points/shop-purchase-non-atomic-race.md`).
- Feedback is invisible to assistive technology.

## Suggested Fix

1. Check the shape of errors thrown by `apiRequest` (`client/src/services/api.ts`) and display the server's message when present, falling back to the generic text.
2. Add a confirmation step before buying (a small modal or inline confirm) that names the item, its cost and the resulting balance, using the same preview components as the card.
3. Track a pending state per purchase so the button is disabled and shows progress while the request runs; also block repeated equip clicks.
4. Add `role="status"` to the success banner and `role="alert"` to the error banner.
5. Update `Shop.test.tsx` (query by role/label per `.claude/rules/rules.md`) for: server error message shown, confirmation required, button disabled while pending.

## Related Files

- `client/src/pages/Shop.tsx`
- `client/src/pages/__tests__/Shop.test.tsx`
- `client/src/services/api.ts`
- `server/src/routes/shop.js`
