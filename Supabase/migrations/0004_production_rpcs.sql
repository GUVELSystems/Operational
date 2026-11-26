-- 0004_production_rpcs.sql — operaciones transaccionales de producción y gestión de miembros.
-- Producción: funciones SECURITY INVOKER (jamás DEFINER): se ejecutan con los permisos del usuario, así RLS sigue aplicando dentro de ellas.
-- Errores: RAISE EXCEPTION con un CÓDIGO como mensaje (MACHINE_BUSY, SESSION_CLOSED, BAD_QTY, SCRAP_GT_QTY, NO_HOURS); el front los traduce.

-- ───────── Utilidades internas ─────────
-- Inserta los eventos de scrap/paros (arreglos JSON) de una captura
create or replace function private.add_events(p_company uuid, p_capture uuid, p_scrap jsonb, p_down jsonb) returns void
language plpgsql as $$
begin
  insert into public.scrap_events (company_id, production_capture_id, scrap_catalog_id, quantity, reason)
    select p_company, p_capture, (e ->> 'scrap_catalog_id')::uuid, coalesce((e ->> 'quantity')::numeric, 0), nullif(e ->> 'reason', '')
    from jsonb_array_elements(coalesce(p_scrap, '[]'::jsonb)) e;
  insert into public.downtime_events (company_id, production_capture_id, downtime_catalog_id, minutes, event_type, reason)
    select p_company, p_capture, (e ->> 'downtime_catalog_id')::uuid, coalesce((e ->> 'minutes')::numeric, 0), coalesce(nullif(e ->> 'event_type', ''), 'Unplanned'), nullif(e ->> 'reason', '')
    from jsonb_array_elements(coalesce(p_down, '[]'::jsonb)) e;
end $$;
revoke all on function private.add_events(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function private.add_events(uuid, uuid, jsonb, jsonb) to authenticated;

create or replace function private.check_qty(p_qty numeric, p_scrap jsonb) returns void
language plpgsql immutable as $$
declare v_scrap numeric;
begin
  if p_qty is null or p_qty < 0 or p_qty <> trunc(p_qty) then raise exception 'BAD_QTY'; end if;
  select coalesce(sum((e ->> 'quantity')::numeric), 0) into v_scrap from jsonb_array_elements(coalesce(p_scrap, '[]'::jsonb)) e;
  if v_scrap > p_qty then raise exception 'SCRAP_GT_QTY'; end if;
end $$;
revoke all on function private.check_qty(numeric, jsonb) from public, anon;
grant execute on function private.check_qty(numeric, jsonb) to authenticated;

create or replace function private.person_name(p_id uuid) returns text
language sql stable as $$ select first_name || ' ' || last_name from public.personnel where id = p_id $$;
revoke all on function private.person_name(uuid) from public, anon;
grant execute on function private.person_name(uuid) to authenticated;

-- ───────── Sesiones ─────────
-- Una sola sesión RUNNING por máquina: lo garantiza el índice único parcial one_running_session_per_machine
create or replace function public.start_session(p_company uuid, p_machine uuid, p_shift uuid, p_customer uuid, p_part uuid, p_operation uuid,
                                                p_lot text, p_operator uuid, p_supervisor uuid)
returns public.machine_production_sessions language plpgsql as $$
declare r public.machine_production_sessions;
begin
  insert into public.machine_production_sessions (company_id, machine_id, shift_id, customer_id, part_number_id, operation_id, lot_number, operator_id, supervisor_id)
  values (p_company, p_machine, p_shift, p_customer, p_part, p_operation, p_lot, p_operator, p_supervisor) returning * into r;
  return r;
exception when unique_violation then raise exception 'MACHINE_BUSY';
end $$;

-- Inserta o ACTUALIZA la captura de esa hora y reemplaza sus eventos
create or replace function public.save_hour(p_session uuid, p_hour_slot text, p_production_date date, p_quantity numeric, p_scrap jsonb, p_downtime jsonb)
returns public.production_captures language plpgsql as $$
declare s public.machine_production_sessions; c public.production_captures;
begin
  select * into s from public.machine_production_sessions where id = p_session for update;
  if s.id is null or s.status <> 'RUNNING' then raise exception 'SESSION_CLOSED'; end if;
  perform private.check_qty(p_quantity, p_scrap);
  select * into c from public.production_captures where session_id = p_session and hour_slot = p_hour_slot for update;
  if c.id is null then
    insert into public.production_captures (company_id, production_date, shift_id, lot_number, customer_id, part_number_id, machine_id, operation_id, operator_name, supervisor_name, production_quantity, confirmed, session_id, hour_slot)
    values (s.company_id, p_production_date, s.shift_id, s.lot_number, s.customer_id, s.part_number_id, s.machine_id, s.operation_id, private.person_name(s.operator_id), private.person_name(s.supervisor_id), p_quantity, true, p_session, p_hour_slot)
    returning * into c;
  else
    update public.production_captures set production_date = p_production_date, captured_at = now(), production_quantity = p_quantity,
           operator_name = private.person_name(s.operator_id), supervisor_name = private.person_name(s.supervisor_id)
     where id = c.id returning * into c;
    delete from public.scrap_events where production_capture_id = c.id;
    delete from public.downtime_events where production_capture_id = c.id;
  end if;
  perform private.add_events(s.company_id, c.id, p_scrap, p_downtime);
  return c;
end $$;

create or replace function public.delete_hour(p_session uuid, p_hour_slot text) returns boolean
language plpgsql as $$
begin delete from public.production_captures where session_id = p_session and hour_slot = p_hour_slot; return true; end $$;   -- los eventos se borran en cascada

-- UNA captura final (hour_slot null); borra las horas Real Time si existían y cierra la sesión
create or replace function public.finish_session_single(p_session uuid, p_production_date date, p_quantity numeric, p_scrap jsonb, p_downtime jsonb)
returns public.production_captures language plpgsql as $$
declare s public.machine_production_sessions; c public.production_captures;
begin
  select * into s from public.machine_production_sessions where id = p_session for update;
  if s.id is null or s.status <> 'RUNNING' then raise exception 'SESSION_CLOSED'; end if;
  perform private.check_qty(p_quantity, p_scrap);
  delete from public.production_captures where session_id = p_session;
  insert into public.production_captures (company_id, production_date, shift_id, lot_number, customer_id, part_number_id, machine_id, operation_id, operator_name, supervisor_name, production_quantity, confirmed, session_id, hour_slot)
  values (s.company_id, p_production_date, s.shift_id, s.lot_number, s.customer_id, s.part_number_id, s.machine_id, s.operation_id, private.person_name(s.operator_id), private.person_name(s.supervisor_id), p_quantity, true, p_session, null)
  returning * into c;
  perform private.add_events(s.company_id, c.id, p_scrap, p_downtime);
  update public.machine_production_sessions set status = 'COMPLETED', finished_at = now() where id = p_session;
  return c;
end $$;

-- Suma las horas, crea UNA captura final, reasigna los eventos, borra las horas y cierra la sesión
create or replace function public.consolidate_and_finish(p_session uuid)
returns public.production_captures language plpgsql as $$
declare s public.machine_production_sessions; c public.production_captures; v_total numeric; v_date date; v_n int;
begin
  select * into s from public.machine_production_sessions where id = p_session for update;
  if s.id is null or s.status <> 'RUNNING' then raise exception 'SESSION_CLOSED'; end if;
  select count(*), coalesce(sum(production_quantity), 0), min(production_date) into v_n, v_total, v_date
    from public.production_captures where session_id = p_session and hour_slot is not null;
  if v_n = 0 then raise exception 'NO_HOURS'; end if;
  insert into public.production_captures (company_id, production_date, shift_id, lot_number, customer_id, part_number_id, machine_id, operation_id, operator_name, supervisor_name, production_quantity, confirmed, session_id, hour_slot)
  values (s.company_id, v_date, s.shift_id, s.lot_number, s.customer_id, s.part_number_id, s.machine_id, s.operation_id, private.person_name(s.operator_id), private.person_name(s.supervisor_id), v_total, true, p_session, null)
  returning * into c;
  update public.scrap_events set production_capture_id = c.id where production_capture_id in (select id from public.production_captures where session_id = p_session and hour_slot is not null);
  update public.downtime_events set production_capture_id = c.id where production_capture_id in (select id from public.production_captures where session_id = p_session and hour_slot is not null);
  delete from public.production_captures where session_id = p_session and hour_slot is not null;
  update public.machine_production_sessions set status = 'COMPLETED', finished_at = now() where id = p_session;
  return c;
end $$;

create or replace function public.cancel_session(p_session uuid) returns boolean
language plpgsql as $$
begin update public.machine_production_sessions set status = 'CANCELLED', finished_at = now() where id = p_session; return found; end $$;

do $$ declare f text; begin
  foreach f in array array['public.start_session(uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,uuid)', 'public.save_hour(uuid,text,date,numeric,jsonb,jsonb)', 'public.delete_hour(uuid,text)',
    'public.finish_session_single(uuid,date,numeric,jsonb,jsonb)', 'public.consolidate_and_finish(uuid)', 'public.cancel_session(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f); execute format('grant execute on function %s to authenticated', f);
  end loop; end $$;

-- ───────── Gestión de miembros (SECURITY DEFINER con comprobaciones explícitas) ─────────
-- Reglas: owner/admin de la empresa (o admin de plataforma). Un admin no puede tocar ni asignar owners. Nadie cambia su propio rol/estado.
-- Siempre debe quedar al menos un owner activo.
create or replace function private.guard_member_change(p_membership uuid, p_new_role public.member_role, p_new_status public.member_status)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.memberships; v_caller public.member_role; v_platform boolean := private.is_platform_admin();
begin
  select * into m from public.memberships where id = p_membership;
  if m.id is null then raise exception 'not found'; end if;
  select role into v_caller from public.memberships where company_id = m.company_id and user_id = (select auth.uid()) and status = 'active';
  if not (v_platform or coalesce(v_caller in ('owner', 'admin'), false)) then raise exception 'not allowed'; end if;
  if m.user_id = (select auth.uid()) then raise exception 'not allowed'; end if;                                            -- no sobre uno mismo
  if not (v_platform or coalesce(v_caller = 'owner', false)) and (m.role = 'owner' or p_new_role = 'owner') then raise exception 'only an owner can change owners'; end if;
  if m.role = 'owner' and m.status = 'active' and (p_new_role <> 'owner' or p_new_status <> 'active')
     and (select count(*) from public.memberships where company_id = m.company_id and role = 'owner' and status = 'active') <= 1 then raise exception 'last owner'; end if;
end $$;
revoke all on function private.guard_member_change(uuid, public.member_role, public.member_status) from public, anon, authenticated;

create or replace function public.set_member_role(p_membership uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership;
  perform private.guard_member_change(p_membership, p_role, m.status);
  update public.memberships set role = p_role where id = p_membership;
end $$;
create or replace function public.set_member_status(p_membership uuid, p_status public.member_status) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership;
  perform private.guard_member_change(p_membership, m.role, p_status);
  update public.memberships set status = p_status where id = p_membership;
end $$;
create or replace function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.invitations;
begin
  select * into i from public.invitations where id = p_invitation;
  if i.id is null or not (private.is_platform_admin() or private.has_role(i.company_id, array['owner','admin']::public.member_role[])) then raise exception 'not allowed'; end if;
  update public.invitations set status = 'revoked' where id = p_invitation and status = 'pending';
end $$;
create or replace function public.platform_rename_company(p_company uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'not allowed'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'invalid name'; end if;
  update public.companies set name = btrim(p_name) where id = p_company and not is_platform;
end $$;
do $$ declare f text; begin
  foreach f in array array['public.set_member_role(uuid,public.member_role)', 'public.set_member_status(uuid,public.member_status)', 'public.revoke_invitation(uuid)', 'public.platform_rename_company(uuid,text)'] loop
    execute format('revoke all on function %s from public, anon', f); execute format('grant execute on function %s to authenticated', f);
  end loop; end $$;
