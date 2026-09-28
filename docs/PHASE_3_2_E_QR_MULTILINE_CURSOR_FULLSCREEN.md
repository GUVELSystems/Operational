# GUVEL Operational — Phase 3.2.E / 3.2.F
## QR code fixed, multiple scrap/downtime lines, cursor survives Full Screen everywhere, Kiosk Full Screen

Base: Phase 3.2.D

### 1. QR code now actually appears
Root cause: the library (`qrcode` on npm) doesn't publish a ready-to-use browser file at the path
we were requesting from the CDN — confirmed by downloading the real npm package and checking; the
`build/` folder our URL pointed at simply isn't part of what's published, so the script 404'd
every time, silently. Switched to `qrcode-generator`, a long-established library that ships its
actual source file at the root of its package (also verified against the real published tarball),
and renders straight to an inline SVG — same approach already used for the barcode, so it prints
at full sharpness. If the CDN still can't be reached, the panel now says so and suggests Refresh.

### 2. Multiple scrap and downtime lines per hour
Real Time (both in Production and in the Kiosk) can now record more than one reason per hour —
your example of 1 piece scrapped for startup and 1 for marks in the same 7:00–8:00 hour now works
exactly like that: each report is its own line with its own Remove button, and every line is
saved. Existing lines are reloaded correctly if you return to edit that hour.

**Found and fixed along the way:** adding a scrap or downtime line was quietly wiping out whatever
had already been typed into "Good pieces this hour" — the field is required, so the browser
silently refused to submit the form afterward, with no error shown. The typed quantity is now
preserved across adding, removing, or editing lines within the same hour.

### 3 & 4. The cursor now survives Full Screen everywhere, and Kiosk has its own Full Screen
Two related fixes:
- **Why the cursor disappeared**: the cursor is a single fixed dot living in the page; whatever
  element goes into native Full Screen only renders its own descendants, so the dot — living
  outside it — went dark. It's now automatically moved inside whatever the current Full Screen
  element is (Dashboard's General/Production/Quality/Downtime, Plant Now's live panel, or Kiosk),
  and moved back on exit.
- **Why that fix alone wasn't enough for Kiosk and Plant Now**: both rebuild their whole screen on
  every save, tab switch, or auto-refresh by replacing the *same element* the cursor had just been
  moved into — destroying it in the process, not just misplacing it. Both now keep a stable outer
  shell (the Full Screen target, never rewritten) with the actual content inside a child that
  redraws freely, so the cursor — parked in the stable shell — survives any number of redraws
  while in Full Screen. Confirmed: adding a scrap line and switching Dashboard tabs while
  fullscreen no longer disturbs the cursor.
- Kiosk now has its own **⛶ Full Screen** button (badge scan, idle, and entry screens), using the
  same mechanism, with no separate cursor issue.

### Files
`js/app.js`, `css/style.css` (cache keys `style.css?v=3.2.E`, `app.js?v=GUVEL-UI31`). No SQL changes.

### Validation
`node --check js/app.js` passes. Against the Supabase mock, using a local copy of the real
`qrcode-generator` package (jsdelivr itself isn't reachable from this offline test environment,
matching how Chart.js is already tested here):
- QR renders as a real, scannable inline SVG in the Machine profile; Print QR opens the same
  GUVEL-styled card as the barcode.
- Two scrap lines (1 + 2 pieces) and one downtime line saved together on one hour, confirmed in
  the database with the exact quantities; the "Good pieces" field confirmed to keep its typed
  value through both additions (previously blanked, silently blocking the save).
- Cursor confirmed present and tracking the mouse inside the Full Screen element for Dashboard
  (`#app`), Plant Now's live panel, and Kiosk — including immediately after a redraw triggered
  while still in Full Screen (a scrap-line add in Kiosk, a tab switch in Dashboard).
- Full kiosk gate flow (Finish Session, Exit) re-verified end to end after the structural change.
- Regression: 13 screens across widths (1920–360px), both themes: no JavaScript errors, no
  horizontal overflow.
