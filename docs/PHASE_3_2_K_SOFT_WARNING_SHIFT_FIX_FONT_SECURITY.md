# GUVEL Operational — Phase 3.2.K
## Soft time warning, Change Product shift fix, kiosk exit lock, Manrope everywhere

Base: Phase 3.2.J

### 1. Finish-time check is now a warning, not a block
Picking an end time before the session started (or after right now) no longer stops you cold.
It shows a yellow **"⚠ Heads up"** banner explaining what will happen — *"If you continue, the
session's own start time will be used instead so it can be saved"* — with **Go back** / **Continue
anyway**. Continuing uses that safe, valid value automatically (the session's real start time, or
the current time), so the close always succeeds instead of hitting the database's own check
constraint.

### 2. Machine barcode is short again
Reverted to the machine's code only (Code 39) — the full-link version got unreadably wide at
print size, as you found. **The QR remains the only "scan to open the Kiosk" code**; the barcode
is for asset ID/labeling.

### 3. Change Product no longer re-asks for the whole shift
Root cause: Real Time's hour list was always anchored to the shift's nominal start (e.g. 7:00 AM)
even when the session itself began later — every Change Product hand-off asked for every hour
since 7:00 AM again, Product A's hours included. Fixed: when a session started after the shift's
nominal start on the same day (which is exactly what happens when Change Product hands off to a
new part mid-shift), Real Time's hour list now starts from that session's own start time instead.
Tested with a session started at 17:30 inside a 14:00–22:00 shift: it correctly asked only for
17:30 onward, not from 14:00.

### 4. Kiosk hand-off: leaving Production now also needs the supervisor's PIN
Closing the machine profile that Kiosk opened for Start/Finish — the ✕, the backdrop, or the
panel's own Close button — now asks for a supervisor's PIN again before letting go, the same PIN
gate used everywhere else in Kiosk. Confirming sends the device straight back to that machine's
Kiosk; a wrong PIN is rejected and the screen stays put. This closes the gap where a supervisor
handed a PIN-authorized session in Production could otherwise walk away and leave the tablet free
to browse every other machine. (Note: this specifically guards leaving that machine's profile —
the top navigation bar itself isn't locked down during a hand-off; flagging that as a known,
narrower scope rather than a full lockdown of Production.)

### 5. The signed-in user now shows under their role
"Planta Apodaca · owner" in the top bar now has the person's name (or email, if no name is on
file) on a second line underneath.

### 6. Manrope, everywhere
Replaced Old Standard TT / Barlow / Barlow Semi Condensed with Manrope across the entire portal —
body text, headings, the GUVEL wordmark, Kiosk, and both printable reports (Machine QR/Barcode
card, Run profile) — each of which loads its own Manrope link since they're independent
print windows that don't inherit the main page's stylesheet.

### Files
`index.html`, `js/app.js`, `css/style.css` (cache keys `style.css?v=3.2.K`, `app.js?v=GUVEL-UI36`).
No SQL changes.

### Validation
`node --check js/app.js` passes. Against the Supabase mock:
- Soft warning confirmed: an 8:00 AM end time on a 2:05 PM session shows the yellow banner with
  the exact wording above; "Continue anyway" advances using 2:05 PM (the session's real start).
- Machine barcode confirmed back to the plain code (e.g. "CNC-01"); Part Number barcodes and the
  QR unaffected.
- A session seeded to start at 17:30 inside a 14:00–22:00 shift correctly limited Real Time's
  pending hours to 17:30 onward.
- Exit-gate confirmed: closing the profile during a hand-off shows the PIN prompt, rejects a wrong
  PIN with a visible message, and a correct PIN redirects back to that machine's Kiosk.
- Company badge confirmed showing the signed-in user's name under their role.
- `h1`/wordmark computed `font-family` confirmed as Manrope.
- Regression: 13 screens across widths (1920–360px), both themes: no JavaScript errors, no
  horizontal overflow. Full Change Product / Finish Soon flow re-run clean on the final build.
