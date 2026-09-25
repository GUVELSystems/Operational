# GUVEL Operational — Phase 3.0.C
## Plant Now dashboard, brand lockup, header copy

Base: Phase 3.0.B

### 1. Plant Now (new Dashboard tab)
- Tab order: General, Production, Quality, Downtime, **Plant Now**.
- Left panel: honeycomb with one hexagon per machine, grouped by code family
  (PRS, CNC, INJ…), sorted by code. Hexagon size adapts to the panel width; rows wrap on phones.
- States (from `machine_production_sessions`):
  - Running — cyan outline: the machine has a RUNNING session.
  - Below target — amber outline: running and its OEE in the period is under the OEE target.
  - Idle — grey outline: no RUNNING session.
- The value in each hexagon is the machine's OEE in the selected period and filters
  (the Machine filter is ignored here so the whole plant is shown).
- Hover shows machine, state, part number, operation, lot and OEE. Click opens that machine in Status.
- Right panel: plant OEE with target gap and Availability / Performance / Quality bars with target marks.
- **Targets** (OEE 85%, Availability 90%, Performance 95%, Quality 99% by default) are editable
  and saved per browser with the other Dashboard settings.
- Machine status refreshes every 60 s while the tab is open (sessions only, not all data).
- Not included: a "Stopped" state. The data model has no live stop/pause status for sessions
  (RUNNING / COMPLETED / CANCELLED only), and downtime is recorded with the capture after the fact.
  Adding it needs a session state or live downtime event (future phase).

### 2. Brand lockup (top-left)
- Mark · hairline divider · wordmark "GUVEL" letter-justified to the width of the tagline
  "Smarter Industrial Systems" (cyan), as in the reference logo. Rendered as text with the brand
  serif, so it stays sharp at any size. On phones the tagline and divider collapse.

### 3. Copy
- Removed "Connected operational visibility." from the Dashboard header.

### Other
- `dashboardPrefs()` now keeps extra preference keys (needed for Plant Now targets; previously any
  unknown key would have been dropped on the next save).
- Dashboard session query also reads lot number, part number and operation for the hexagon tooltip.
- Tabs scroll horizontally on phones instead of wrapping.
- Cache keys: `style.css?v=3.0.C`, `app.js?v=GUVEL-UI20`. No SQL.

### Validation
- `node --check js/app.js` passes.
- Plant Now: 8 hexagons rendered, states change when the OEE target changes, target persists,
  clicking a running hexagon opens the Status modal of that machine.
- Regression: 14 screens × 7 widths (1920–360px): no JavaScript errors, no horizontal overflow.
