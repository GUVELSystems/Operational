# GUVEL Operational — Phase 3.2.D
## Kiosk: automatic Start/Finish round-trip, and how the three views stay connected

Base: Phase 3.2.C

### 1. "Supervisor: Start Session" now opens only that machine, and returns automatically
Before, this just sent the device to Production's normal page, leaving the supervisor to find the
right machine themselves. Now: PIN confirmed → Production opens with that exact machine's profile
already open, showing the Start Production form directly — nothing else to click through. Once
the supervisor submits it successfully, the device is sent straight back to this machine's kiosk,
no manual navigation needed.

### 2. "Supervisor: Finish Session" now actually finishes it
Before, this also just opened Production and left the supervisor to repeat the Finish Session
steps themselves — the machine kept running. Now, when the session has hours logged (the normal
case), confirming the PIN finishes it immediately, right there in the kiosk: the hours are folded
into one record (same as 3.1.C), the session closes, and the kiosk returns to "No active session"
— no redirect at all. The confirmation screen tells the supervisor up front what they're closing:
*"This closes the session and records the 3 hours captured (558 pieces total) as one entry."*
The one edge case that still hands off to Production: a session with zero hours logged (nothing
to total automatically) opens that machine's profile so a supervisor can enter the quantity by
hand, then returns to the kiosk the same way Start does.

### 3. How Plant Now, Production and Kiosk stay connected
All three read the same session and production data — a session started or finished from Kiosk is
immediately the same session Production and Plant Now already show, not a separate record. Plant
Now's machine tiles and Kiosk's own poll both refresh automatically (every 60 seconds); Production
caches its machine/shift/customer lists for up to 60 seconds for speed (Phase 3.1.C) but always
reads sessions and hours fresh. The isolation is deliberate and one-directional: Kiosk can only
read and act on the one machine it's locked to, and only through the specific actions built for
it (log an hour, or hand off to a supervisor's PIN for Start/Finish) — it never gets the nav, the
other machines, or Production's other tools (Substitute information, Single Entry, editing past
hours). Nothing about this phase changes that boundary; it only makes crossing it — supervisor to
Production and back — automatic instead of manual.

### Files
`js/app.js` (cache keys `style.css?v=3.2.D`, `app.js?v=GUVEL-UI30`). No CSS or SQL changes.

### Validation
`node --check js/app.js` passes. Against the Supabase mock:
- **Start round-trip**: confirmed the redirect lands on Production with that exact machine's
  Start Production form auto-opened (screenshot), and confirmed the return-to-kiosk redirect URL
  is correct and only fires after the insert succeeds (the code path is gated behind the same
  success check used everywhere else in Production). The very last leg — the kiosk showing the
  new session live after the browser lands back on it — could not be exercised end-to-end in this
  offline mock, because a full page navigation resets the mock's in-memory fixture (it isn't a
  real database); this is a limitation of the test double, not of the app, since every piece of
  the chain is independently proven. **Worth one real test on your deployment** to see the full
  loop close, since it's the one part I couldn't watch happen in one continuous run here.
- **Finish (with hours)**: fully verified end to end, no navigation involved — 3 pre-seeded hours
  (558 pieces) correctly consolidated into one `production_captures` row with the operator and
  supervisor's names, the session set to `COMPLETED`, and the kiosk returning to "No active
  session" automatically. Confirmed the same record shows correctly in the Production register
  afterward.
- Regression: 13 screens across widths (1920–360px), both themes: no JavaScript errors, no
  horizontal overflow.
