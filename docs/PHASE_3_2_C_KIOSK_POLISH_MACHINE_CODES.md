# GUVEL Operational — Phase 3.2.C
## Kiosk cursor fix, first-pending-hour targeting, printable machine QR/barcode

Base: Phase 3.2.B

### 1. Cursor was invisible in Floor Kiosk
Root cause: the custom cursor dot (`#laserCursor`) lived *inside* `#app`'s markup, and Kiosk mode
hides `#app` entirely (`display:none`) to show its own full-screen view — hiding the cursor along
with it, with the native cursor already suppressed everywhere else. Moved `#laserCursor` in
`index.html` to be a sibling of `#app`/`#authScreen` instead of a child, so hiding either of those
no longer hides the cursor. Confirmed visible and tracking the pointer inside Kiosk mode.

### 2. Kiosk always targets the first hour not yet logged
Previously the entry screen showed whatever hour the wall clock said was "now" — logging behind
schedule meant jumping straight to the current hour and silently skipping the gap. It now always
targets the earliest hour in the shift that has no entry yet. When more than one hour is waiting,
a banner says so plainly: **"Pendiente registrar: 17:00 – 18:00, 18:00 – 19:00, 19:00 – 20:00…"**
Saving one hour advances straight to the next pending one, in order, until caught up.

### 3. Machines: a printable QR and barcode for each machine
The Machine profile (Machines → select a machine) now has a **Floor Kiosk access** card with:
- The exact Kiosk link for that machine, with a Copy button.
- A **QR code** encoding that link — scanning it with a phone or tablet camera opens that
  machine's kiosk directly. Rendered by a small library loaded on demand (only when a machine
  profile is opened, not on every page load), from the same kind of CDN this app already uses for
  Chart.js.
- A **barcode** (Code 39) encoding the machine's code as plain text, for asset labeling. This
  reuses the same generator the Part Number profile already had (previously duplicated inline
  there; now a single shared function).
- **Print QR** / **Print Barcode** buttons, each opening a GUVEL-styled printable card (logo,
  wordmark, machine code and name, the code itself, sized for a label or index card).

If the QR library can't load (no network), the QR panel says "QR unavailable offline" instead of
breaking; the barcode never depends on the network at all.

### Files
`index.html`, `js/app.js`, `css/style.css` (cache keys `style.css?v=3.2.C`, `app.js?v=GUVEL-UI29`).
No SQL changes.

### Validation
`node --check js/app.js` passes. Against the Supabase mock:
- Cursor confirmed outside `#app` in the DOM and visibly tracking mouse movement inside Kiosk mode.
- A session with 6 hours elapsed and only 3 logged shows "Pendiente registrar: 17:00 – 18:00,
  18:00 – 19:00, …, 21:00 – 22:00" and targets 17:00–18:00 first; saving it moves the target to
  18:00–19:00 and shortens the pending list.
- Full kiosk gate flow re-tested end to end after these changes: wrong PIN rejected, correct PIN
  confirms an over-cycle-time entry and exits the kiosk, same as 3.2.A.
- Machine profile: kiosk link, barcode, and Print Barcode (opens a popup with the GUVEL-styled
  card and a working Code 39 SVG) all confirmed; QR degrades to a clear offline message when the
  CDN library can't be reached (as in this offline test environment) without breaking the page.
- Part Number profile's own barcode re-verified unaffected after sharing the generator.
- Regression: 13 screens across widths (1920–360px), both themes: no JavaScript errors, no
  horizontal overflow.
