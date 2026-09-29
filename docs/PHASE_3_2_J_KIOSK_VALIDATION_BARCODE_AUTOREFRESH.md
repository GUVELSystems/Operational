# GUVEL Operational — Phase 3.2.J
## Finish-time validation, clearer Kiosk buttons, full-link machine barcode, Dashboard auto-refresh everywhere

Base: Phase 3.2.I

### 1. Finish Early no longer lets you pick a time before the session started
The raw Postgres error (`machine_production_sessions_valid_dates`) is gone from the user's path.
The "Actual end time" field in Change Product / Finish Early now has a `min` set to the session's
own start time and a `max` of right now; picking (or typing) something outside that range shows a
plain message — *"The end time can't be before this part started, 9/24/2026, 2:05:00 PM"* — and
stays on the same screen instead of failing at save time. A matching check on the save itself
translates that same database error into the same message, in case it's ever reached another way.

### 2. Change Product and Finish Session, visually separated
Both are real buttons now, stacked with clear spacing instead of two inline links touching each
other. **Finish Session** — the irreversible, end-of-shift action — has a red outline so it doesn't
get tapped by habit next to Change Product.

### 3. Machine barcode now encodes the full Kiosk link
Code 39 (still used for Part Numbers, unchanged) can only represent uppercase letters, digits and
a handful of symbols — a URL's lowercase letters and slashes would have come out as unreadable
dashes. The machine barcode now uses CODE128 instead (verified against the real published
`jsbarcode` package, same verification approach as the QR fix), which supports the full character
set a link needs. Scanning either the QR or the barcode on a Machine profile now opens that
machine's Kiosk directly.

### 4. Dashboard auto-refreshes everywhere, not just Plant Now
General, Production, Quality and Downtime now refresh themselves every 60 seconds while open —
previously only Plant Now did this; the rest needed a manual Refresh click, which is what you'd
been doing. It skips a refresh while the filter popover is open (so it can't disrupt something
you're mid-way through choosing) and while the tab is in the background.

### Files
`js/app.js`, `css/style.css`, `index.html` (cache keys `style.css?v=3.2.J`, `app.js?v=GUVEL-UI35`).
No SQL changes.

### Validation
`node --check js/app.js` passes. Against the Supabase mock:
- Picking 8:00 AM as the end time for a session that started 2:05 PM was blocked with the exact
  message above, staying on the confirmation screen; picking a valid later time (3:30 PM)
  correctly advanced to the next step.
- Confirmed `button.kiosk-footer-btn-end`'s red border actually renders (the first attempt lost to
  a more specific pre-existing `button.secondary` rule; increased specificity to match and win).
- Machine barcode confirmed to encode the exact Kiosk URL (checked the SVG's own text label);
  Part Number barcodes re-verified unaffected.
- Confirmed the Dashboard's auto-refresh timer starts, fires on General and Production alike
  without breaking their rendering, and is correctly skipped while the filter popover is open.
- Regression: 13 screens across widths (1920–360px), both themes: no JavaScript errors, no
  horizontal overflow. Full Change Product / Finish Soon flow re-run end to end on the final build.
