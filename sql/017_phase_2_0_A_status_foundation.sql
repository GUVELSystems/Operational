-- GUVEL Operational — Phase 2.0.A — Machine Status Foundation
-- Non-destructive: creates new session table; does not alter legacy capture tables.
create table if not exists public.machine_production_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  part_number_id uuid not null references public.part_numbers(id) on delete restrict,
  lot_number text not null,
  operation_id uuid references public.operations(id) on delete restrict,
  operator_id uuid references public.personnel(id) on delete restrict,
  supervisor_id uuid references public.personnel(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'active' check (status in ('active','finished','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machine_production_sessions_finish_check check (finished_at is null or finished_at >= started_at)
);
create unique index if not exists ux_machine_production_sessions_one_active_machine
  on public.machine_production_sessions(company_id, machine_id) where status='active';
create index if not exists ix_machine_production_sessions_company_status
  on public.machine_production_sessions(company_id, status);
create index if not exists ix_machine_production_sessions_machine_started
  on public.machine_production_sessions(company_id, machine_id, started_at desc);
alter table public.machine_production_sessions enable row level security;
drop policy if exists machine_production_sessions_select on public.machine_production_sessions;
drop policy if exists machine_production_sessions_insert on public.machine_production_sessions;
drop policy if exists machine_production_sessions_update on public.machine_production_sessions;
create policy machine_production_sessions_select on public.machine_production_sessions for select using (company_id = public.current_company_id());
create policy machine_production_sessions_insert on public.machine_production_sessions for insert with check (company_id = public.current_company_id());
create policy machine_production_sessions_update on public.machine_production_sessions for update using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
