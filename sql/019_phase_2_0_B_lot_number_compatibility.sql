-- GUVEL Operational — Phase 2.0.B — lot_number compatibility
-- Adds the lot number field when machine_production_sessions existed before Phase 2.0.A.
-- Safe for repeated execution.

alter table if exists public.machine_production_sessions
  add column if not exists lot_number text;

-- Preserve NOT NULL behavior required by the Status start-production form.
-- Existing legacy rows without a lot receive a neutral placeholder.
update public.machine_production_sessions
set lot_number = 'UNASSIGNED'
where lot_number is null;

alter table public.machine_production_sessions
  alter column lot_number set not null;
