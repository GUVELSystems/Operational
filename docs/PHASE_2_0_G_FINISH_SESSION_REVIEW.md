# Phase 2.0.G — Finish Session Review

## Database contract verified

`machine_production_sessions.status` accepts exactly:

- `RUNNING`
- `COMPLETED`
- `CANCELLED`

The application now writes `RUNNING` when starting and `COMPLETED` when finishing. It no longer writes the invalid lowercase value `finished`.

## Finish behavior

- Finish updates only the selected session.
- It requires the session to still be `RUNNING`, preventing duplicate/stale finishes.
- It writes `finished_at` and `updated_at` using the same timestamp.
- It validates in the browser that finish time is not earlier than `started_at`, matching `machine_production_sessions_valid_dates`.
- Production, scrap, and downtime remain transactional capture records linked by `production_capture_id`. Finish Session closes the machine session; SAVE in Capture creates the production record and its linked scrap/downtime records.
