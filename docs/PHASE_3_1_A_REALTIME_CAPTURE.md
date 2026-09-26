# GUVEL Operational — Phase 3.1.A
## Real-time hour-by-hour capture, Finish Session preview, and a live Plant Now panel

Base: Phase 3.0.F

### 1. Real Time (Status)
On a running machine's profile, next to **Finish Session** there is now a **Real Time** button.
It opens an hour-by-hour capture panel for the current session:

- One row per hour from the session's start to the current hour (the list shows the most recent
  24 hours; earlier hours, if any, stay counted in the totals but are not listed row by row).
- Each hour can be logged with Good Pieces, Scrap (by defect, from the same catalog as Capture)
  and Downtime (by reason, Planned/Unplanned) — the same detail as a normal capture.
- A running totals bar (Good pieces, Scrap, Scrap rate, Downtime, Hours logged) updates as hours
  are saved.
- Saving an hour writes an ordinary `production_captures` row tagged with the session and that
  hour (see the schema note below), so it is immediately visible everywhere: Production, Quality
  and Downtime dashboards, Plant Now, and the Registers all read it with no changes on their side.
- The machine card in Status now shows a small "N hours logged (Real Time)" pill while a session
  has real-time hours.

### 2. Finish Session detects Real Time hours
Clicking **Finish Session**:
- **No hours were logged with Real Time** → behaves exactly as before: the single end-of-session
  form (Production Quantity, Scrap, Downtime).
- **Hours were logged** → shows a read-only review instead: the session's recap, the totals bar,
  and the hour-by-hour list. **Substitute information** reveals Edit / Delete on each hour and
  **+ Add** on any hour not yet logged, so a supervisor can correct what was captured, hour by
  hour, without losing the rest. **Confirm and Finish Session** closes the session; the hourly
  captures already are the record, so nothing else is created.

### 3. Plant Now opens a live machine panel instead of leaving the tab
Clicking a hexagon in Plant Now no longer jumps to Status. It opens a panel over the Dashboard
with: the machine's current session (customer, part number, operation, lot, shift, started time),
the same totals bar, and the hour-by-hour list logged so far. It refreshes automatically every
30 seconds while open. An idle machine shows a short message instead. **Open in Status** is still
one click away, for anyone who needs to start a session, use Real Time, or finish it.

### Schema
`sql/022_phase_3_1_A_realtime_hourly_captures.sql` adds two nullable columns to the existing
`production_captures` table — `session_id` (which session this belongs to) and `hour_slot`
(the hour it represents) — plus a unique index so each session has at most one row per hour.
No new tables. Scrap and downtime keep using `scrap_events` / `downtime_events` exactly as
today, linked to whichever capture (hourly or end-of-session) they belong to. This is why no
dashboard, register or KPI formula needed to change: they already read these three tables.

### Explicitly unchanged
KPI formulas and thresholds, the standalone Capture page, Customers/Part Numbers/Machines/Catalog/
Registers/Personnel/Settings, and the design system from 3.0.A–3.0.F.

### Validation
`node --check js/app.js` passes. Tested against a Supabase mock extended for this phase (relational
embedding of scrap/downtime totals, `upsert`, `.not(...,'is',null)`) with a pre-seeded session
carrying 3 hours of Real Time history:
- Real Time on a running machine: logs a new hour, totals and the "hours logged" pill update.
- Real Time on an idle machine: not offered (only Start Production is).
- Finish Session with existing hours: shows the totals and list; Substitute information reveals
  Edit (pre-filled with that hour's real scrap/downtime) and + Add; editing recalculates totals
  immediately; Confirm and Finish Session closes the session and returns the machine to Idle.
- Plant Now: a running machine's click opens the live panel with matching totals and hour list;
  an idle machine's click shows the "no active session" state with a working "Open in Status".
- Regression: 14 screens × 7 widths (1920–360px), both themes: no JavaScript errors, no
  horizontal overflow.

Deploy note: run the SQL migration before deploying these files.
