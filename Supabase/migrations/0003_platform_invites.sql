-- 0003_platform_invites.sql — empresa madre (GUVEL Systems), alta de empresas e invitaciones con token.
-- La empresa madre es una fila de companies con is_platform = true. Sus owners/admins activos son los "administradores de plataforma":
-- pueden crear y administrar empresas, pero NO tienen acceso a los datos de producción de ninguna empresa (las políticas de 0002 no los incluyen).

alter table public.companies
  add column if not exists is_platform boolean not null default false,
  add column if not exists domain_status text not null default 'pending' check (domain_status in ('pending', 'active', 'error')),
  add column if not exists status_changed_at timestamptz;
-- 'guvel' y 'platform' quedan reservados para la empresa madre (la fila de plataforma se inserta con slug 'guvel' antes de activar el CHECK de clientes)
alter table public.companies drop constraint slug_not_reserved;
alter table public.companies add constraint slug_not_reserved check (is_platform or slug not in ('guvel', 'platform', 'www', 'api', 'admin', 'operational', 'app', 'mail', 'static', 'cdn', 'auth'));
create unique index if not exists only_one_platform on public.companies (is_platform) where is_platform;
alter table public.memberships add column if not exists first_name text, add column if not exists last_name text, add column if not exists email text;   -- email copiado de la invitación: la UI de Users lo muestra sin tocar auth.users

create or replace function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m join public.companies c on c.id = m.company_id
                 where c.is_platform and c.status = 'active' and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin'));
$$;
revoke all on function private.is_platform_admin() from public, anon;
grant execute on function private.is_platform_admin() to authenticated;

-- Los administradores de plataforma ven todas las empresas y membresías (solo esas tablas)
create policy companies_platform_read   on public.companies   for select to authenticated using (private.is_platform_admin());
create policy memberships_platform_read on public.memberships for select to authenticated using (private.is_platform_admin());

-- resolve_company ahora también dice si es la empresa madre (el front decide si muestra la consola de plataforma)
drop function if exists public.resolve_company(text);
create or replace function public.resolve_company(p_slug text)
returns table (id uuid, name text, slug text, status public.company_status, is_platform boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.slug, c.status, c.is_platform from public.companies c where c.slug = lower(p_slug) limit 1;
$$;
revoke all on function public.resolve_company(text) from public;
grant execute on function public.resolve_company(text) to anon, authenticated;

-- ───────── Invitaciones ─────────
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  email       text not null check (email = lower(email)),
  first_name  text not null check (length(btrim(first_name)) > 0),
  last_name   text not null check (length(btrim(last_name)) > 0),
  role        public.member_role not null,
  token_hash  text not null unique,                                  -- SHA-256 del token; el token en claro NUNCA se guarda
  status      public.invitation_status not null default 'pending',
  invited_by  uuid references auth.users(id),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index one_pending_invite_per_email on public.invitations (company_id, email) where status = 'pending';
alter table public.invitations enable row level security;
revoke all on public.invitations from anon;
create policy invitations_read on public.invitations for select to authenticated
  using (private.has_role(company_id, array['owner','admin']::public.member_role[]) or private.is_platform_admin());
-- Sin políticas de escritura: solo las funciones de abajo (y la Edge Function) crean/aceptan invitaciones.

-- Crear invitación (owner/admin de la empresa; un admin no puede invitar owners). El token en claro lo genera la Edge Function
-- (para enviarlo por correo) y a la base solo llega su hash SHA-256.
create or replace function public.create_invitation(p_company uuid, p_email text, p_first text, p_last text, p_role public.member_role, p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_caller_role public.member_role;
begin
  select m.role into v_caller_role from public.memberships m join public.companies c on c.id = m.company_id
   where m.company_id = p_company and m.user_id = (select auth.uid()) and m.status = 'active' and c.status = 'active';
  if not (private.is_platform_admin() or coalesce(v_caller_role in ('owner', 'admin'), false)) then raise exception 'not allowed'; end if;   -- coalesce: sin membresía v_caller_role es NULL y NOT NULL no bloquearía
  if p_role = 'owner' and not (private.is_platform_admin() or coalesce(v_caller_role = 'owner', false)) then raise exception 'only an owner can invite owners'; end if;
  if exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id where m.company_id = p_company and lower(u.email) = lower(p_email) and m.status <> 'disabled')
    then raise exception 'already a member'; end if;
  update public.invitations set status = 'revoked' where company_id = p_company and email = lower(p_email) and status = 'pending';
  insert into public.invitations (company_id, email, first_name, last_name, role, token_hash, invited_by) values (p_company, lower(p_email), btrim(p_first), btrim(p_last), p_role, p_token_hash, (select auth.uid())) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_invitation(uuid, text, text, text, public.member_role, text) from public, anon;
grant execute on function public.create_invitation(uuid, text, text, text, public.member_role, text) to authenticated;

-- Alta de empresa (solo administradores de plataforma). La Edge Function llama a esto, crea el hostname en Cloudflare y envía el correo.
create or replace function public.platform_create_company(p_name text, p_slug text, p_owner_email text, p_owner_first text, p_owner_last text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_platform_admin() then raise exception 'not allowed'; end if;
  insert into public.companies (name, slug) values (btrim(p_name), lower(p_slug)) returning id into v_id;      -- slug validado por el CHECK de 0001
  insert into public.invitations (company_id, email, first_name, last_name, role, token_hash, invited_by) values (v_id, lower(p_owner_email), btrim(p_owner_first), btrim(p_owner_last), 'owner', p_token_hash, (select auth.uid()));
  return v_id;
end $$;
revoke all on function public.platform_create_company(text, text, text, text, text, text) from public, anon;
grant execute on function public.platform_create_company(text, text, text, text, text, text) to authenticated;

create or replace function public.platform_set_company_status(p_company uuid, p_status public.company_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'not allowed'; end if;
  update public.companies set status = p_status, status_changed_at = now() where id = p_company and not is_platform;
end $$;
revoke all on function public.platform_set_company_status(uuid, public.company_status) from public, anon;
grant execute on function public.platform_set_company_status(uuid, public.company_status) to authenticated;

-- Pantalla de aceptación (anónimo): ¿el enlace es válido para ESTA empresa? Devuelve solo lo necesario, sin el hash ni el id.
create or replace function public.get_invitation(p_slug text, p_token_hash text)
returns table (company_name text, email text, first_name text, last_name text, role public.member_role, state text)
language sql stable security definer set search_path = '' as $$
  select c.name, i.email, i.first_name, i.last_name, i.role,
         case when i.status = 'accepted' then 'used' when i.status = 'revoked' then 'revoked' when i.expires_at < now() then 'expired' else 'ok' end
  from public.invitations i join public.companies c on c.id = i.company_id
  where i.token_hash = p_token_hash and c.slug = lower(p_slug) and c.status = 'active' limit 1;
$$;
revoke all on function public.get_invitation(text, text) from public;
grant execute on function public.get_invitation(text, text) to anon, authenticated;

-- Aceptar: la ejecuta SOLO la Edge Function accept-invite con service_role (crea/confirma el usuario de Auth y fija su contraseña);
-- esta función consume la invitación y crea la membresía de forma atómica. El correo del usuario debe coincidir con el de la invitación.
create or replace function public.consume_invitation(p_slug text, p_token_hash text, p_user uuid, p_first text, p_last text)
returns public.member_role language plpgsql security definer set search_path = '' as $$
declare i public.invitations; c public.companies; v_email text;
begin
  select * into c from public.companies where slug = lower(p_slug) and status = 'active';
  select * into i from public.invitations where token_hash = p_token_hash and company_id = c.id and status = 'pending' and expires_at >= now() for update;
  if i.id is null then raise exception 'invalid invitation'; end if;
  select lower(email) into v_email from auth.users where id = p_user;
  if v_email is distinct from i.email then raise exception 'email mismatch'; end if;
  insert into public.memberships (company_id, user_id, role, status, first_name, last_name, email)
    values (c.id, p_user, i.role, 'active', coalesce(nullif(btrim(p_first), ''), i.first_name), coalesce(nullif(btrim(p_last), ''), i.last_name), i.email)
    on conflict (company_id, user_id) do update set role = excluded.role, status = 'active', first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email;
  update public.invitations set status = 'accepted', accepted_at = now() where id = i.id;
  return i.role;
end $$;
revoke all on function public.consume_invitation(text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_invitation(text, text, uuid, text, text) to service_role;

-- Primera vez (una sola): crea la empresa madre y su primer administrador DESDE el SQL Editor (service role):
--   insert into public.companies (name, slug, is_platform, domain_status) values ('GUVEL Systems', 'guvel', true, 'active');
--   insert into public.memberships (company_id, user_id, role, first_name, last_name, email)
--     select c.id, u.id, 'owner', 'Tu nombre', 'Tu apellido', u.email from public.companies c, auth.users u where c.is_platform and u.email = 'tu-correo@guvelsystems.com';
