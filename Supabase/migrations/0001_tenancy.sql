-- 0001_tenancy.sql — base multi-empresa de GUVEL Operational System (proyecto Supabase NUEVO)
-- Empresas, membresías, funciones de ayuda para RLS y la función pública de resolución por subdominio.
-- Regla de oro: el subdominio solo identifica la empresa en pantalla; el acceso a los datos lo decide SIEMPRE RLS con auth.uid().
-- (Plantas: no se implementan ahora. Si se necesitan, se agrega plants(company_id, id) y plant_id a las tablas con FK compuesta.)

create extension if not exists pgcrypto;
create schema if not exists private;                      -- funciones internas: NO expuestas por la API
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;           -- las políticas RLS las evalúan como "authenticated"

-- ───────── Empresas ─────────
create type public.company_status as enum ('active', 'suspended', 'terminated');
create type public.member_role    as enum ('owner', 'admin', 'manager', 'supervisor', 'guest');
create type public.member_status  as enum ('active', 'invited', 'disabled');

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  slug        text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),   -- operational.<slug>.guvelsystems.com
  status      public.company_status not null default 'active',
  created_at  timestamptz not null default now(),
  constraint slug_not_reserved check (slug not in ('www', 'api', 'admin', 'operational', 'app', 'mail', 'static', 'cdn', 'auth'))
);
comment on column public.companies.slug is 'Se usa en el subdominio. Inmutable una vez publicado (cambiarlo rompe los enlaces).';

-- ───────── Membresías (quién puede entrar a qué empresa y con qué rol) ─────────
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.member_role not null default 'guest',
  status      public.member_status not null default 'active',
  created_at  timestamptz not null default now(),
  unique (company_id, user_id)
);
create index on public.memberships (user_id) where status = 'active';

-- ───────── Funciones de ayuda (SECURITY DEFINER: leen memberships sin pasar por su propia RLS) ─────────
-- Empresas ACTIVAS donde el usuario actual tiene membresía ACTIVA. Suspender/dar de baja una empresa corta todo el acceso a sus datos.
create or replace function private.member_companies() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.company_id
  from public.memberships m join public.companies c on c.id = m.company_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and c.status = 'active';
$$;

create or replace function private.has_role(cid uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m join public.companies c on c.id = m.company_id
    where m.user_id = (select auth.uid()) and m.company_id = cid and m.status = 'active' and c.status = 'active' and m.role = any (roles));
$$;
revoke all on function private.member_companies() from public, anon;
revoke all on function private.has_role(uuid, public.member_role[]) from public, anon;
grant execute on function private.member_companies() to authenticated;
grant execute on function private.has_role(uuid, public.member_role[]) to authenticated;

-- ───────── Resolución pública por subdominio: SOLO id, nombre, slug y estado (nada más) ─────────
create or replace function public.resolve_company(p_slug text)
returns table (id uuid, name text, slug text, status public.company_status)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.slug, c.status from public.companies c where c.slug = lower(p_slug) limit 1;
$$;
revoke all on function public.resolve_company(text) from public;
grant execute on function public.resolve_company(text) to anon, authenticated;

-- ───────── Tras iniciar sesión: ¿tiene este usuario acceso a la empresa de ESTE subdominio? ─────────
create or replace function public.my_membership(p_slug text)
returns table (company_id uuid, role public.member_role)
language sql stable security definer set search_path = '' as $$
  select m.company_id, m.role
  from public.memberships m join public.companies c on c.id = m.company_id
  where c.slug = lower(p_slug) and c.status = 'active' and m.status = 'active' and m.user_id = (select auth.uid());
$$;
revoke all on function public.my_membership(text) from public, anon;
grant execute on function public.my_membership(text) to authenticated;

-- ───────── RLS de companies y memberships ─────────
alter table public.companies   enable row level security;
alter table public.memberships enable row level security;
revoke all on public.companies, public.memberships from anon;

create policy companies_member_read on public.companies for select to authenticated using (id in (select private.member_companies()));
-- Sin políticas de insert/update/delete: las empresas se administran desde el módulo Empresa (service role / backend), nunca desde el navegador.

create policy memberships_read_own  on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy memberships_read_team on public.memberships for select to authenticated using (private.has_role(company_id, array['owner','admin']::public.member_role[]));
-- Invitar, cambiar roles o deshabilitar: módulo Usuarios vía funciones SECURITY DEFINER / backend (pendiente de activar).
