-- 0002_domain_rls.sql — tablas de negocio (columnas tomadas de la capa G.db del prototipo) con aislamiento por empresa.
-- Aislamiento en 3 capas:  (1) company_id NOT NULL en cada tabla  (2) FK COMPUESTAS (company_id, id): una fila de la empresa A jamás
-- puede apuntar a una fila de la empresa B  (3) RLS: solo empresas ACTIVAS donde el usuario es miembro ACTIVO; escritura según rol.
-- Matriz de roles = la PROPUESTA del prototipo (G.PERMS); validar antes de producción.

-- Roles que pueden escribir cada grupo de tablas
-- masters  : owner, admin, manager            (clientes, partes, máquinas, operaciones, turnos, personal, catálogos, notices)
-- capture  : owner, admin, manager, supervisor (sesiones, capturas, scrap, paros)
create or replace function private.can_write(cid uuid, grp text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(cid, case grp when 'capture' then array['owner','admin','manager','supervisor']::public.member_role[]
                                        else array['owner','admin','manager']::public.member_role[] end);
$$;
grant execute on function private.can_write(uuid, text) to authenticated;

-- ───────── Maestros ─────────
create table public.customers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  code text not null, name text not null, created_at timestamptz not null default now(),
  unique (company_id, id), unique (company_id, code));
create table public.machines (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  code text not null, name text not null, brand text, created_at timestamptz not null default now(),
  unique (company_id, id), unique (company_id, code));
create table public.shifts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  code text not null, name text not null, start_time time, end_time time, excluded_planned_minutes numeric not null default 0,
  created_at timestamptz not null default now(), unique (company_id, id), unique (company_id, code));
create table public.personnel (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id text not null, first_name text not null, last_name text not null, role text, is_active boolean not null default true,
  created_at timestamptz not null default now(), unique (company_id, id), unique (company_id, employee_id));
create table public.downtime_catalog (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  code text not null, downtime text not null, category text, created_at timestamptz not null default now(),
  unique (company_id, id), unique (company_id, code));

create table public.part_numbers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid, part_number text not null, description text, piece_cost numeric, scrap_cost numeric, created_at timestamptz not null default now(),
  unique (company_id, id), unique (company_id, part_number),
  foreign key (company_id, customer_id) references public.customers (company_id, id));
create table public.operations (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  part_number_id uuid not null, operation_number int not null, operation_name text not null, ideal_cycle_time_seconds numeric,
  created_at timestamptz not null default now(), unique (company_id, id), unique (company_id, part_number_id, operation_number),
  foreign key (company_id, part_number_id) references public.part_numbers (company_id, id) on delete cascade);
create table public.part_number_machines (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  part_number_id uuid not null, machine_id uuid not null, created_at timestamptz not null default now(),
  unique (company_id, id), unique (company_id, part_number_id, machine_id),
  foreign key (company_id, part_number_id) references public.part_numbers (company_id, id) on delete cascade,
  foreign key (company_id, machine_id)     references public.machines (company_id, id)     on delete cascade);
create table public.operation_machine_cycle_times (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  operation_id uuid not null, part_number_id uuid not null, machine_id uuid not null, cycle_time_seconds numeric not null,
  created_at timestamptz not null default now(), unique (company_id, id),
  foreign key (company_id, operation_id)   references public.operations (company_id, id)   on delete cascade,
  foreign key (company_id, part_number_id) references public.part_numbers (company_id, id) on delete cascade,
  foreign key (company_id, machine_id)     references public.machines (company_id, id)     on delete cascade);
create table public.scrap_catalog (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  code text not null, defect text not null, category text, part_number_id uuid, operation_id uuid, created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, part_number_id) references public.part_numbers (company_id, id) on delete cascade,
  foreign key (company_id, operation_id)   references public.operations (company_id, id)   on delete cascade);

-- ───────── Producción ─────────
create table public.machine_production_sessions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  machine_id uuid not null, shift_id uuid not null, customer_id uuid not null, part_number_id uuid not null, operation_id uuid not null,
  lot_number text, operator_id uuid, supervisor_id uuid, started_at timestamptz not null default now(), finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'COMPLETED', 'CANCELLED')), created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, machine_id)     references public.machines (company_id, id),
  foreign key (company_id, shift_id)       references public.shifts (company_id, id),
  foreign key (company_id, customer_id)    references public.customers (company_id, id),
  foreign key (company_id, part_number_id) references public.part_numbers (company_id, id),
  foreign key (company_id, operation_id)   references public.operations (company_id, id),
  foreign key (company_id, operator_id)    references public.personnel (company_id, id),
  foreign key (company_id, supervisor_id)  references public.personnel (company_id, id));
-- Una sola sesión RUNNING por máquina (dentro de la empresa)
create unique index one_running_session_per_machine on public.machine_production_sessions (company_id, machine_id) where status = 'RUNNING';

create table public.production_captures (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  production_date date not null, captured_at timestamptz not null default now(), shift_id uuid not null, lot_number text,
  customer_id uuid, part_number_id uuid not null, machine_id uuid not null, operation_id uuid, operator_name text, supervisor_name text,
  production_quantity numeric not null check (production_quantity >= 0), confirmed boolean not null default true, session_id uuid, hour_slot text,
  created_at timestamptz not null default now(), unique (company_id, id),
  foreign key (company_id, shift_id)       references public.shifts (company_id, id),
  foreign key (company_id, customer_id)    references public.customers (company_id, id),
  foreign key (company_id, part_number_id) references public.part_numbers (company_id, id),
  foreign key (company_id, machine_id)     references public.machines (company_id, id),
  foreign key (company_id, operation_id)   references public.operations (company_id, id),
  foreign key (company_id, session_id)     references public.machine_production_sessions (company_id, id));
create index on public.production_captures (company_id, production_date);

create table public.scrap_events (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  production_capture_id uuid not null, scrap_catalog_id uuid not null, quantity numeric not null check (quantity >= 0), reason text,
  created_at timestamptz not null default now(), unique (company_id, id),
  foreign key (company_id, production_capture_id) references public.production_captures (company_id, id) on delete cascade,
  foreign key (company_id, scrap_catalog_id)      references public.scrap_catalog (company_id, id));
create table public.downtime_events (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  production_capture_id uuid not null, downtime_catalog_id uuid not null, minutes numeric not null check (minutes >= 0),
  event_type text not null default 'Unplanned', reason text, created_at timestamptz not null default now(), unique (company_id, id),
  foreign key (company_id, production_capture_id) references public.production_captures (company_id, id) on delete cascade,
  foreign key (company_id, downtime_catalog_id)   references public.downtime_catalog (company_id, id));

create table public.notices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, report_type text not null, icon text, color text, blocks text[], language text default 'en', frequency text not null,
  weekday int, month_day int, send_time time, timezone text not null default 'America/Mexico_City', recipients text[] not null default '{}',
  subject text, active boolean not null default true, group_by_part boolean not null default true, last_sent_at timestamptz,
  created_at timestamptz not null default now(), unique (company_id, id));

-- ───────── RLS: lectura para miembros; escritura por rol; sin acceso anónimo ─────────
do $$
declare t text; g text;
begin
  for t, g in select * from (values
    ('customers','masters'), ('machines','masters'), ('shifts','masters'), ('personnel','masters'), ('downtime_catalog','masters'),
    ('part_numbers','masters'), ('operations','masters'), ('part_number_machines','masters'), ('operation_machine_cycle_times','masters'),
    ('scrap_catalog','masters'), ('notices','masters'),
    ('machine_production_sessions','capture'), ('production_captures','capture'), ('scrap_events','capture'), ('downtime_events','capture')
  ) as v(t, g) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I on public.%I for select to authenticated using (company_id in (select private.member_companies()))', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write(company_id, %L))', t || '_ins', t, g);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write(company_id, %L)) with check (private.can_write(company_id, %L))', t || '_upd', t, g, g);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write(company_id, %L))', t || '_del', t, g);
  end loop;
end $$;

-- company_id jamás cambia (evita "mover" una fila a otra empresa con un UPDATE)
create or replace function private.lock_company_id() returns trigger language plpgsql as $$
begin if new.company_id is distinct from old.company_id then raise exception 'company_id is immutable'; end if; return new; end $$;
do $$ declare t text; begin
  for t in select unnest(array['customers','machines','shifts','personnel','downtime_catalog','part_numbers','operations','part_number_machines',
    'operation_machine_cycle_times','scrap_catalog','machine_production_sessions','production_captures','scrap_events','downtime_events','notices']) loop
    execute format('create trigger lock_company_id before update on public.%I for each row execute function private.lock_company_id()', t);
  end loop; end $$;

-- ───────── Archivos (Storage): carpeta = company_id ─────────
-- create policy "company files read"  on storage.objects for select to authenticated using (bucket_id = 'company-files' and (storage.foldername(name))[1]::uuid in (select private.member_companies()));
-- create policy "company files write" on storage.objects for insert to authenticated with check (bucket_id = 'company-files' and private.can_write((storage.foldername(name))[1]::uuid, 'masters'));

-- ───────── Transacciones (saveHour, consolidateAndFinish, startSession…) ─────────
-- Al migrarlas a funciones SQL: LANGUAGE plpgsql SECURITY INVOKER (jamás DEFINER) para que RLS se siga aplicando dentro de ellas.
