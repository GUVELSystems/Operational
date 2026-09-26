-- GUVEL Operational — Phase 3.1.A
-- Real-time hour-by-hour capture, linked to a machine production session.
--
-- Design: an "hourly entry" is an ordinary production_captures row (same table used by
-- Capture and by Finish Session today) that additionally carries session_id and hour_slot.
-- This means Quality, Downtime, Production dashboards and the Registers already work with
-- real-time data with no further changes: they all read production_captures/scrap_events/
-- downtime_events as before. A row with session_id set and hour_slot null is a normal
-- Finish Session capture (today's behavior, unchanged). A row with both set is one hour of
-- a session captured through Real Time.

alter table public.production_captures
  add column if not exists session_id uuid references public.machine_production_sessions(id) on delete set null,
  add column if not exists hour_slot timestamptz;

create index if not exists idx_production_captures_session on public.production_captures(session_id);

-- One entry per hour per session (Real Time saves upsert into this).
create unique index if not exists ux_production_captures_session_hour
  on public.production_captures(session_id, hour_slot)
  where session_id is not null and hour_slot is not null;

comment on column public.production_captures.session_id is 'Machine production session this capture belongs to, when captured from Status (Real Time or Finish Session). Null for captures made from the standalone Capture page.';
comment on column public.production_captures.hour_slot is 'Start of the hour this entry represents (Real Time). Null for a single end-of-session capture (Finish Session without Real Time) or a Capture-page entry.';
