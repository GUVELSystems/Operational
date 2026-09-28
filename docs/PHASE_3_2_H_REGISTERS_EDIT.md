# GUVEL Operational — Phase 3.2.H
## Registers: Scrap and Downtime events can be corrected in place

Base: Phase 3.2.G

Each Scrap and Downtime row now has an **Edit** button next to Delete — opens that row inline
(defect/reason, quantity, and free-text reason for Scrap; downtime reason, minutes, Planned/
Unplanned, and free-text reason for Downtime) with Save/Cancel. Saving updates only that
`scrap_events` / `downtime_events` row directly; the Production capture it belongs to is
untouched. **Production rows remain read-only in Registers, on purpose** — quantity corrections
belong in Production/Kiosk (Real Time, or the pencil on Recent Hours), where they're tied to a
specific hour and, once a session is Real-Time based, a supervisor's authorization.

### Files
`js/app.js`, `css/style.css` (cache keys `style.css?v=3.2.H`, `app.js?v=GUVEL-UI33`). No SQL changes.

### Validation
`node --check js/app.js` passes. Edited a Scrap row (quantity 24→77, added a reason) and a
Downtime row (minutes→42, type→Planned); both saved to the database and re-rendered correctly in
the table. Confirmed the Production tab has no Edit button. Regression re-run clean.
