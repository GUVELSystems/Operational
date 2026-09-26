# GUVEL Operational — Phase 3.0.F
## Fix: Plant Now was not detecting running machines correctly

Base: Phase 3.0.E

### Bug
`machine_production_sessions.status` is `'active' | 'finished' | 'cancelled'` (see
`sql/017_phase_2_0_A_status_foundation.sql`). Status itself already checks correctly with
`['RUNNING','ACTIVE','IN_PROGRESS'].includes(status.toUpperCase())`. Plant Now (3.0.C), however,
only matched `status.toUpperCase()==='RUNNING'`, so real sessions (status `'active'`) were never
matched — every machine showed as Idle in Plant Now regardless of its real state. This was caught
now, while designing the real-time work you asked for next, and did not surface earlier because
the demo fixture used to test 3.0.C used the status value `'RUNNING'` instead of the real one.

### Fix
Plant Now now uses the same match as Status: `['RUNNING','ACTIVE','IN_PROGRESS']`.

Files: `js/app.js` (cache key bumped with `index.html`, `style.css?v=3.0.F`). No CSS or SQL changes.
