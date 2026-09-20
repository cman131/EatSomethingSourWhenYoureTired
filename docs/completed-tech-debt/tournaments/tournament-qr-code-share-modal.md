# Tournament QR Code Share Modal

## State

Complete

## Summary

The tournament detail page has a "Share" button (`ShareButton`) that copies the current URL
to the clipboard, but offers no QR code option. At in-person events, organizers and players
often want to share the tournament link by displaying a QR code for others to scan with their
phone camera. There is no QR code feature anywhere in the app and no QR library installed.

## Problem Details

**File:** `client/src/pages/TournamentDetail.tsx:483-486`

The share area renders `ShareButton` only:

```tsx
<div className="w-full sm:w-auto">
  <ShareButton title="Share this tournament" />
</div>
```

`ShareButton` (`client/src/components/ShareButton.tsx:15-38`) uses `navigator.clipboard.writeText`
on `window.location.href` — clipboard-only, no QR generation.

**File:** `client/package.json`

No QR code library is installed. A library such as `qrcode.react` (MIT, zero peer
dependencies) is required before any QR rendering is possible.

## Impact

- Users at in-person events cannot share the tournament page via phone camera scan
- Organizers must verbally dictate the URL or paste it into a separate messaging app
- The existing ShareButton is useless in contexts where clipboard paste is not practical (e.g., showing a phone screen to someone across a table)

## Suggested Fix

1. Install `qrcode.react` in the client: `npm install qrcode.react`
2. Create `client/src/components/QRCodeModal.tsx` — reusable modal accepting a `url: string`
   prop that renders a `<QRCodeSVG>` inside the standard modal shell already used by
   `FuCalculatorModal` and `EditTournamentModal` (backdrop, `XMarkIcon` close button,
   matching card style)
3. Create `client/src/components/QRCodeButton.tsx` — small button using `QrCodeIcon` from
   `@heroicons/react/24/outline` that manages its own `isOpen` state and renders `<QRCodeModal>`
4. In `TournamentDetail.tsx` at line 483, add `<QRCodeButton>` next to the existing
   `<ShareButton>` in the action buttons row, passing `window.location.href` as the URL

## Related Files

- `client/src/pages/TournamentDetail.tsx`
- `client/src/components/ShareButton.tsx`
- `client/src/components/QRCodeModal.tsx` (new)
- `client/src/components/QRCodeButton.tsx` (new)
- `client/package.json`
