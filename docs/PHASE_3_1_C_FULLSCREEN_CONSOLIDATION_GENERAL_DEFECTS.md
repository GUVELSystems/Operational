# GUVEL Operational — Phase 3.1.C
## Full-screen machine dashboard, one register per session, corrected session OEE, faster Production, editable/General defects

Base: Phase 3.1.B

### 1. Plant Now: full-screen machine dashboard
Clicking a machine now opens a dedicated full-screen page (not a small popup): header with
machine, state and a **⛶ Full Screen** button (uses the browser's native full-screen mode, same
as the Dashboard's own Full Screen), the session recap, Session OEE, and the hour-by-hour log,
all edge to edge.

### 2. Finish Session now leaves exactly one register entry per session
Real Time's hourly rows were only ever meant as a live working buffer. Confirming **Finish
Session** now folds every hour captured into a single production record: it sums the production
quantity, re-points every scrap and downtime line item captured along the way to that one record,
deletes the hourly rows, and only then closes the session. Registers show one row for the whole
session, exactly like a session finished without Real Time — with the same scrap and downtime
detail preserved underneath it. (Single Entry is unaffected: it already produces one row.)

### 3. Session OEE corrected: measured against the hours actually logged
The previous version measured Planned Production Time against the wall clock (time elapsed in
the shift), which understated Performance whenever an hour hadn't been logged yet. It now uses
the total length of the hours actually captured — 2 hours logged means OEE is calculated against
those 2 hours, not against however much of the shift has elapsed. This matches how the Production
dashboard measures a finished period, and no longer depends on the clock at all.

### 4. Auto-refresh every 60 seconds
The machine dashboard's auto-refresh changed from 30 to 60 seconds, matching Plant Now's own
session poll — one consistent interval across both live surfaces.

### 5. Production loads faster on repeat visits
Two changes, no visible behavior difference other than speed:
- Machines, shifts, customers, part numbers, personnel, operations and their links are cached for
  60 seconds instead of being refetched — in full — every single time Production is opened. Live
  data (sessions, hourly counts) is still always fetched fresh.
- The Scrap/Downtime catalogs used by Real Time and Finish Session were being refetched on every
  single machine click; they're now fetched once and cached the same way.
This cuts a visit to Production from 10 queries down to 3 within that 60-second window (and cuts
opening a machine's Real Time or Finish Session from 2 extra queries down to 0 on repeat opens).
Master data changed elsewhere (e.g. a new machine added) can take up to 60 seconds to show up in
Production; use the browser refresh if you need it sooner.

### 6. Part Numbers → Defects is no longer read-only
It now has an Add Defect form (Operation, Code, Defect, Category) so a defect can be registered
without leaving the Part Number profile. General defects (see below) show up here automatically,
labeled "General — all Part Numbers"; editing those still happens in Catalog.

### 7. Catalog → Defects: a "General" option
Checking **General** on the Add Scrap Defect form ignores Part Number and Operation entirely; the
defect is saved once and applies to every Part Number — including ones added afterward — in
Capture, Real Time, Finish Session and the Part Number Defects tab. `part_number_id` and
`operation_id` on `scrap_catalog` are now nullable for this (migration
`sql/023_phase_3_1_C_general_scrap_defects.sql`); every existing part-specific defect is unaffected.

### Files
`js/app.js`, `css/style.css`, `index.html` (cache keys `style.css?v=3.1.C`, `app.js?v=GUVEL-UI24`),
`sql/023_phase_3_1_C_general_scrap_defects.sql` (run before deploying).

### Validation
`node --check js/app.js` passes. Against the Supabase mock:
- Finish Session on a 3-hour Real Time session left exactly one `production_captures` row
  (558 combined pieces), its 3 scrap events re-pointed to it, and the 3 hourly rows gone.
- Session OEE recomputed on that same session: 93.3% Availability, 49.8% Performance, 98.4%
  Quality, 45.8% OEE — matching the hand-worked example in the code comments, independent of the
  system clock.
- The machine dashboard opens covering the full viewport with a working Full Screen button.
- Catalog: a General defect saves with Part Number disabled, lists as "General — all Part
  Numbers", and immediately appears on every Part Number's Defects tab; adding a part-specific
  defect from a Part Number's own Defects tab works and appears in that list.
- Regression: 14 screens × 4 widths (1920, 1440, 1024, 390px) plus 820/360px on the busiest
  screens, both themes: no JavaScript errors, no horizontal overflow.
