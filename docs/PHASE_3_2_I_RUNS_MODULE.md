# GUVEL Operational — Phase 3.2.I
## New module: Runs — traceability history with a per-run profile and a one-page printout

Base: Phase 3.2.H

### What it is
A new **Runs** item in the nav, just before Settings. Every finished production capture — the
same records Registers' Production tab already lists — is one "run", numbered sequentially
(RUN-000001, RUN-000002, …) in the order it happened. The list has the same filters as Registers
(date range, Customer, Part Number, Machine, free-text search by lot/part/machine).

### The Run Profile
Clicking **View Profile** opens a dedicated page for that run:
- **Details**: Customer, Part Number, Operation, Machine, Lot, Shift, Operator, Supervisor,
  Date/Time.
- **Metrics**: Cantidad Producida, Good Parts, Scrap Parts, FTQ, COPQ, Downtime (minutes) — COPQ
  uses the exact same formula as the Quality dashboard (Poor Quality Cost ÷ Total Produced Cost),
  computed for this one run instead of a whole period.
- Two tables underneath: every **Scrap Event** and every **Downtime Event** tied to that specific
  capture — defect/reason, category, quantity or minutes, and the free-text reason someone typed
  at the time.

This is built for exactly the traceability case you described: a customer complaint about rust on
a part, look up the lot in Runs, and the Scrap Events table for that run shows "Piezas con Óxido"
directly if that's what was logged — no digging through Registers filters or cross-referencing
capture IDs by hand.

### Print
A **Print** button on the profile opens a one-page, GUVEL-branded report (wordmark, navy rule,
the run number in the corner) with the same details, metrics, and both event tables, sized to
print cleanly on one page.

### Files
`js/app.js`, `css/style.css`, `index.html` (nav entry; cache keys `style.css?v=3.2.I`,
`app.js?v=GUVEL-UI34`). No SQL changes — Runs reads the same `production_captures`, `scrap_events`
and `downtime_events` tables everything else already uses.

### Validation
`node --check js/app.js` passes. Loaded 611 runs from the mock dataset; opened a run with a real
scrap event (SC-02 / Crack / 24 pcs) and confirmed it appears correctly in that run's Scrap Events
table and nowhere else; Print opened a correctly laid-out one-page report with the same figures.
Regression: 9 screens across widths (1920–360px), both themes: no JavaScript errors, no horizontal
overflow.
