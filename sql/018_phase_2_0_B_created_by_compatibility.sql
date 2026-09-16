-- GUVEL Operational — Phase 2.0.B — created_by compatibility
-- Safe migration for installations where machine_production_sessions already existed
-- without the optional created_by column.

alter table if exists public.machine_production_sessions
  add column if not exists created_by uuid references auth.users(id);

