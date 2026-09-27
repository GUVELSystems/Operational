# GUVEL Operational — Phase 3.2.A
## Floor Kiosk: machine-locked device, badge scan, supervisor PIN

Base: Phase 3.1.F

### What this is
A device (tablet) physically fixed at one machine, opened with a link like
`https://your-portal/index.html?kiosk=PRS-01`. It shows nothing but that one machine, in a
simplified screen built for touch and, going forward, a barcode/QR badge scanner. There is no
navigation, no other machines, and no access to the rest of the portal from this screen.

### How it works
1. **Badge scan.** The operator scans (or types) their badge code. The device remembers who's
   scanned in across a page reload, so a stray refresh mid-shift doesn't force a re-scan; "Not
   you?" clears it.
2. **No active session.** If nobody has started production on this machine, the kiosk says so and
   offers "Supervisor: Start Session" — gated by a supervisor PIN, which hands off to Production
   (Start Session there has the full customer/part/operation/lot form; kiosk doesn't duplicate it).
3. **Active session — log the hour.** Shows the part, operation, lot, and the current hour
   (bound to the shift, same as Real Time in Production: a 07:00–16:30 shift stops offering hours
   at 16:30). One big Good Pieces field, plus optional one-line Scrap and Downtime reports. Saves
   with the operator's name attached, into the exact same `production_captures` row the rest of
   the app already reads — nothing new for Registers, Quality, or Downtime to learn.
4. **Too many pieces.** If the quantity is more than 15% above what the part's configured cycle
   time makes possible in that hour, saving is blocked until a supervisor enters their PIN to
   confirm it's correct. No cycle time configured → no check (nothing to compare against).
5. **Finishing the session, or leaving the kiosk** — both need a supervisor PIN. Finish hands off
   to Production's own Finish Session (with everything from 3.1.C: hours reviewed, consolidated
   into one register entry). Exiting returns the device to the normal, full portal.

### Supervisor PINs
Set from **Personnel** — a "Set PIN" button next to any Supervisor. 4–8 digits, entered twice.
The PIN is never stored or transmitted as plain text: it's hashed with bcrypt (`pgcrypto`) in
Postgres, and even the personnel table's own `pin_hash` column is not selectable by the app's
normal client role — only two database functions can touch it, `set_personnel_pin` (write) and
`verify_personnel_pin` (a yes/no check). The app never sees or handles a real hash. **Badge codes**
are set from the same personnel record (any role).

### Files
`sql/024_phase_3_2_A_floor_kiosk_foundation.sql` (run before deploying — adds `badge_code` and
`pin_hash` to `personnel`, and the two PIN functions). `js/app.js`, `css/style.css`, `index.html`
(cache keys `style.css?v=3.2.A`, `app.js?v=GUVEL-UI28`).

### Explicitly out of scope for this phase
Actually wiring a barcode/QR hardware scanner — the badge field already accepts scanner input
today (scanners type the code and press Enter, exactly like a keyboard), so no extra work should
be needed once the reader arrives, but it hasn't been tested against real hardware. Also out of
scope: printing/generating the machine QR codes themselves (the kiosk link needs to exist first);
a management screen for badge codes beyond the Personnel field added here.

### Validation
`node --check js/app.js` passes. Tested against a Supabase mock extended with badge codes and a
mock PIN-verification RPC:
- Badge scan recognizes a valid code and rejects an unknown one with a clear message.
- An idle machine shows "No active session"; an unknown machine code shows "Machine not found".
- Logging an hour within the expected pace saves directly; logging far above the part's cycle
  time (9999 pieces) is blocked until a supervisor's PIN is entered — a wrong PIN is rejected with
  a visible message, the correct PIN saves it.
- Exiting the kiosk is blocked the same way, and succeeds with the correct PIN, returning to the
  normal, fully-navigable portal.
- Rendered at three tablet sizes (768×1024, 1024×768, 390×844): no horizontal overflow.
- Regression on the rest of the portal: 13 screens across widths (1920–390px), both themes: no
  JavaScript errors, no horizontal overflow.
