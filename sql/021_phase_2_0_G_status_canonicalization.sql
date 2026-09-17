-- GUVEL Operational - definitive session status canonicalization
-- Canonical values used by the application: RUNNING, COMPLETED, CANCELLED
begin;

alter table if exists public.machine_production_sessions
  add column if not exists status text;

-- Normalize values created by previous incompatible versions.
update public.machine_production_sessions
set status = case upper(trim(coalesce(status, 'RUNNING')))
  when 'ACTIVE' then 'RUNNING'
  when 'IN_PROGRESS' then 'RUNNING'
  when 'STARTED' then 'RUNNING'
  when 'FINISHED' then 'COMPLETED'
  when 'COMPLETE' then 'COMPLETED'
  when 'CANCELLED' then 'CANCELLED'
  when 'CANCELED' then 'CANCELLED'
  when 'COMPLETED' then 'COMPLETED'
  when 'RUNNING' then 'RUNNING'
  else 'RUNNING'
end;

alter table public.machine_production_sessions
  alter column status set default 'RUNNING',
  alter column status set not null;

-- Remove only status-related CHECK constraints, regardless of their old names.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.machine_production_sessions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.machine_production_sessions drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.machine_production_sessions
  add constraint machine_production_sessions_status_check
  check (status in ('RUNNING','COMPLETED','CANCELLED'));

-- Rebuild the active-machine uniqueness rule using the canonical RUNNING value.
drop index if exists public.ux_machine_production_sessions_one_active_machine;
drop index if exists public.uq_machine_production_sessions_active_machine;
create unique index if not exists ux_machine_production_sessions_one_running_machine
  on public.machine_production_sessions(company_id, machine_id)
  where status = 'RUNNING';

commit;
