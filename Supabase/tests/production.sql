-- production.sql — pruebas de las funciones de producción (0004) y de las reglas de miembros. Termina en ROLLBACK.
begin;

-- Usuarios y empresas
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@a.test'),
  ('a2a2a2a2-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@a.test'),
  ('a3a3a3a3-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup@a.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@b.test');
insert into public.companies (id, name, slug) values ('c0000000-0000-0000-0000-00000000000a', 'Empresa A', 'empresa-a'), ('c0000000-0000-0000-0000-00000000000b', 'Empresa B', 'empresa-b');
insert into public.memberships (id, company_id, user_id, role) values
  ('e1000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-00000000000a', 'owner'),
  ('e2000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'a2a2a2a2-0000-0000-0000-00000000000a', 'admin'),
  ('e3000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'a3a3a3a3-0000-0000-0000-00000000000a', 'supervisor'),
  ('e1000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000b', 'owner');
-- Maestros de A y de B
insert into public.customers (id, company_id, code, name) values ('d1000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'C1', 'Cliente'), ('d1000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', 'C1', 'Cliente');
insert into public.machines (id, company_id, code, name) values
  ('f1000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'PRS-01', 'Prensa 1'), ('f2000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'PRS-02', 'Prensa 2'),
  ('f1000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', 'PRS-01', 'Prensa 1');
insert into public.shifts (id, company_id, code, name) values ('a1000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'T1', 'Turno 1');
insert into public.personnel (id, company_id, employee_id, first_name, last_name) values ('b1000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'E1', 'Ana', 'Lopez');
insert into public.part_numbers (id, company_id, customer_id, part_number) values ('90000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000a', 'PN-1');
insert into public.operations (id, company_id, part_number_id, operation_number, operation_name, ideal_cycle_time_seconds) values ('80000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-00000000000a', 10, 'Stamp', 30);
insert into public.scrap_catalog (id, company_id, code, defect) values ('70000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'S1', 'Burr');
insert into public.downtime_catalog (id, company_id, code, downtime) values ('60000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'D1', 'Breakdown');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare s public.machine_production_sessions; s2 public.machine_production_sessions; c public.production_captures; n int; t numeric; msg text;
        A constant uuid := 'c0000000-0000-0000-0000-00000000000a';
begin
  -- Iniciar sesión; una segunda en la misma máquina debe fallar
  s := public.start_session(A, 'f1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-00000000000a', 'L1', 'b1000000-0000-0000-0000-00000000000a', null);
  assert s.status = 'RUNNING', 'sesión RUNNING';
  begin perform public.start_session(A, 'f1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-00000000000a', 'L2', null, null); assert false, 'debió fallar MACHINE_BUSY';
  exception when others then assert sqlerrm = 'MACHINE_BUSY', 'esperaba MACHINE_BUSY, fue: ' || sqlerrm; end;

  -- Horas: la misma hora se ACTUALIZA, no se duplica; los eventos se reemplazan
  c := public.save_hour(s.id, '2026-11-20T08:00:00.000Z', '2026-11-20', 100, '[{"scrap_catalog_id":"70000000-0000-0000-0000-00000000000a","quantity":3}]', '[{"downtime_catalog_id":"60000000-0000-0000-0000-00000000000a","minutes":5,"event_type":"Unplanned"}]');
  assert c.operator_name = 'Ana Lopez', 'nombre del operador desde personnel';
  c := public.save_hour(s.id, '2026-11-20T08:00:00.000Z', '2026-11-20', 120, '[{"scrap_catalog_id":"70000000-0000-0000-0000-00000000000a","quantity":4}]', '[]');
  select count(*) into n from public.production_captures where session_id = s.id; assert n = 1, 'una captura por hora, hubo ' || n;
  select count(*) into n from public.scrap_events where production_capture_id = c.id; assert n = 1, 'eventos reemplazados';
  select count(*) into n from public.downtime_events where production_capture_id = c.id; assert n = 0, 'paros reemplazados';
  c := public.save_hour(s.id, '2026-11-20T09:00:00.000Z', '2026-11-20', 80, '[{"scrap_catalog_id":"70000000-0000-0000-0000-00000000000a","quantity":2}]', '[]');

  -- Validaciones
  begin perform public.save_hour(s.id, '2026-11-20T10:00:00.000Z', '2026-11-20', 5, '[{"scrap_catalog_id":"70000000-0000-0000-0000-00000000000a","quantity":9}]', '[]'); assert false, 'debió fallar';
  exception when others then assert sqlerrm = 'SCRAP_GT_QTY', 'esperaba SCRAP_GT_QTY: ' || sqlerrm; end;
  begin perform public.save_hour(s.id, '2026-11-20T10:00:00.000Z', '2026-11-20', -1, '[]', '[]'); assert false, 'debió fallar';
  exception when others then assert sqlerrm = 'BAD_QTY', 'esperaba BAD_QTY: ' || sqlerrm; end;

  -- Consolidar: una captura final con la suma, eventos reasignados, horas borradas, sesión cerrada
  c := public.consolidate_and_finish(s.id);
  assert c.production_quantity = 200 and c.hour_slot is null, 'suma 120 + 80, fue ' || c.production_quantity;
  select count(*) into n from public.production_captures where session_id = s.id; assert n = 1, 'solo la captura final';
  select coalesce(sum(quantity), 0) into t from public.scrap_events where production_capture_id = c.id; assert t = 6, 'scrap reasignado (4 + 2), fue ' || t;
  select status into msg from public.machine_production_sessions where id = s.id; assert msg = 'COMPLETED', 'sesión COMPLETED';
  begin perform public.consolidate_and_finish(s.id); assert false, 'debió fallar';
  exception when others then assert sqlerrm = 'SESSION_CLOSED', 'esperaba SESSION_CLOSED: ' || sqlerrm; end;

  -- La máquina quedó libre; cierre directo de una sola captura
  s2 := public.start_session(A, 'f1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-00000000000a', 'L3', null, null);
  c := public.finish_session_single(s2.id, '2026-11-21', 50, '[]', '[{"downtime_catalog_id":"60000000-0000-0000-0000-00000000000a","minutes":10,"event_type":"Planned"}]');
  assert c.production_quantity = 50, 'cierre directo';
  begin perform public.consolidate_and_finish(s2.id); assert false; exception when others then assert sqlerrm = 'SESSION_CLOSED'; end;

  -- Borrar una captura borra sus eventos (cascada)
  delete from public.production_captures where id = c.id; select count(*) into n from public.downtime_events where production_capture_id = c.id; assert n = 0, 'cascada de eventos';
  raise notice 'OK: funciones de producción';
end $$;

-- Otra empresa NO puede usar la sesión ni las máquinas de A
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare s public.machine_production_sessions; ok boolean;
begin
  reset role; select * into s from public.machine_production_sessions limit 1; set local role authenticated;
  begin perform public.save_hour(s.id, '2026-11-22T08:00:00.000Z', '2026-11-22', 10, '[]', '[]'); ok := false; exception when others then ok := sqlerrm = 'SESSION_CLOSED'; end; assert ok, 'B no puede escribir en sesiones de A';
  begin perform public.start_session('c0000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-00000000000a', null, null, null, null, null, null, null); ok := false; exception when others then ok := true; end; assert ok, 'B no puede usar máquinas de A';
  begin perform public.start_session('c0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-00000000000a', 'X', null, null); ok := false; exception when others then ok := true; end; assert ok, 'B no puede crear sesiones en A';
  raise notice 'OK: aislamiento en funciones de producción';
end $$;

-- Reglas de miembros
select set_config('request.jwt.claims', '{"sub":"a2a2a2a2-0000-0000-0000-00000000000a","role":"authenticated"}', true);   -- admin de A
do $$ declare ok boolean; r public.member_role; begin
  begin perform public.set_member_role('e1000000-0000-0000-0000-00000000000a', 'guest'); ok := false; exception when others then ok := true; end; assert ok, 'un admin no puede tocar a un owner';
  begin perform public.set_member_role('e3000000-0000-0000-0000-00000000000a', 'owner'); ok := false; exception when others then ok := true; end; assert ok, 'un admin no puede crear owners';
  begin perform public.set_member_role('e2000000-0000-0000-0000-00000000000a', 'guest'); ok := false; exception when others then ok := true; end; assert ok, 'nadie cambia su propio rol';
  perform public.set_member_role('e3000000-0000-0000-0000-00000000000a', 'manager');
  reset role; select role into r from public.memberships where id = 'e3000000-0000-0000-0000-00000000000a'; set local role authenticated; assert r = 'manager', 'el admin sí cambia a un supervisor';
  perform public.set_member_status('e3000000-0000-0000-0000-00000000000a', 'disabled');
  raise notice 'OK: reglas de admin';
end $$;
select set_config('request.jwt.claims', '{"sub":"a3a3a3a3-0000-0000-0000-00000000000a","role":"authenticated"}', true);   -- ahora deshabilitado
do $$ declare n int; begin select count(*) into n from public.customers; assert n = 0, 'un miembro deshabilitado no ve datos'; raise notice 'OK: miembro deshabilitado sin acceso'; end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);   -- owner de A
do $$ declare ok boolean; begin
  begin perform public.set_member_status('e1000000-0000-0000-0000-00000000000a', 'disabled'); ok := false; exception when others then ok := true; end; assert ok, 'el owner no puede deshabilitarse (ni dejar la empresa sin owner)';
  perform public.set_member_status('e3000000-0000-0000-0000-00000000000a', 'active');
  raise notice 'OK: reglas de owner';
end $$;

rollback;
