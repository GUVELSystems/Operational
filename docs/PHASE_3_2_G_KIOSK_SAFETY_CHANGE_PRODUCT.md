# GUVEL Operational — Phase 3.2.G
## Enter-to-submit, editable Recent Hours, Planned downtime confirmation, Change Product / Finish Soon

Base: Phase 3.2.F

### 1. Enter submits the supervisor PIN
Pressing Enter in the PIN field now does the same as tapping the confirm button — works for
Start Session, Finish Session, and every other supervisor-gated action in Kiosk.

### 2. Recent Hours can be corrected — supervisor only
Each row in "Recent hours" now has a small ✎ pencil. Tapping it asks for a supervisor's PIN, then
opens that exact hour pre-filled with what was saved (quantity, scrap lines, downtime lines) so it
can be corrected. Saving returns automatically to the current hour; a "Back to current hour" link
is available if you open the wrong one by mistake. The cycle-time check still applies to a
corrected entry, same as a fresh one.

### 3. Planned downtime also needs a supervisor
Unplanned already only mattered for the cycle-time check; now choosing **Planned** for a downtime
line asks a supervisor to confirm it before it's added — a changeover or a scheduled stop should
have someone with authority behind it, the same way an over-pace quantity does.

### 4. Change Product / Finish Soon (Low Volume – High Mix)
A new supervisor-gated action, next to Finish Session: **Change Product / Finish Early**.
- Step 1, **Confirm Total Hours**: shows the run's computed window (start time → the end of the
  last hour actually logged) and offers **Confirm** or **Edit** (type the real stop time — e.g. a
  part that only ran 7:00–9:30 even though the shift continues).
- Step 2, **What's next?**: **Change Product** closes this run with that end time and immediately
  opens Start Production for the next part on the same machine (returning to Kiosk automatically
  once started, same as the existing Start flow); **Finish Soon** just closes the run there.
Either way, the session's `finished_at` reflects the real stop time instead of whenever a
supervisor happened to close it out — which is what keeps this run's Availability from being
counted against for time after a deliberate, planned stop.

### Files
`js/app.js`, `css/style.css` (cache keys `style.css?v=3.2.G`, `app.js?v=GUVEL-UI32`). No SQL changes.

### Validation
`node --check js/app.js` passes. Against the Supabase mock:
- Enter-to-submit confirmed on the PIN gate.
- Edited a past hour (192 → 210 pieces) via the pencil; totals and the "Save Hour" flow (including
  the cycle-time gate) behaved identically to editing the current hour.
- Confirmed the Planned-downtime gate blocks the line until a supervisor confirms.
- Full Change Product / Finish Soon flow run twice: once with the computed default end time
  ("Finish Soon" closed the session with `finished_at` set to the end of the last logged hour, not
  "now"), and once with a manually edited end time (9:30 AM) that correctly redirected to Start
  Production for the next part with that exact `finished_at` value.
- Regression: 6 screens across widths (1920–390px) focused on Kiosk-adjacent surfaces: no
  JavaScript errors, no horizontal overflow.
