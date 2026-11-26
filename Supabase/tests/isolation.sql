-- isolation.sql — prueba de aislamiento entre empresas (ejecutar en el SQL Editor de un proyecto de PRUEBA, no en producción).
-- Simula a dos usuarios autenticados de empresas distintas y verifica que ninguno vea ni toque datos del otro.
-- Todo corre dentro de una transacción que termina en ROLLBACK: no deja datos.
begin;

-- Datos de prueba (como superusuario)
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@a.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@b.test');
insert into public.companies (id, name, slug) values
  ('c0000000-0000-0000-0000-00000000000a', 'Empresa A', 'empresa-a'), ('c0000000-0000-0000-0000-00000000000b', 'Empresa B', 'empresa-b');
insert into public.memberships (company_id, user_id, role) values
  ('c0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-00000000000a', 'owner'),
  ('c0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000b', 'owner');
insert into public.customers (id, company_id, code, name) values
  ('d0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'CA', 'Cliente A'),
  ('d0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', 'CB', 'Cliente B');

-- A partir de aquí: usuario de la empresa A, rol "authenticated" (RLS activa)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare n int; ok boolean;
begin
  select count(*) into n from public.customers;                                   assert n = 1, 'A solo debe ver 1 cliente (el suyo), vio ' || n;
  select count(*) into n from public.customers where company_id = 'c0000000-0000-0000-0000-00000000000b'; assert n = 0, 'A no debe ver clientes de B';
  select count(*) into n from public.companies;                                   assert n = 1, 'A solo ve su empresa';
  select count(*) into n from public.memberships;                                 assert n = 1, 'A solo ve sus membresías';

  update public.customers set name = 'HACK' where id = 'd0000000-0000-0000-0000-00000000000b'; get diagnostics n = row_count;  assert n = 0, 'A no puede actualizar filas de B';
  delete from public.customers where id = 'd0000000-0000-0000-0000-00000000000b';              get diagnostics n = row_count;  assert n = 0, 'A no puede borrar filas de B';

  begin insert into public.customers (company_id, code, name) values ('c0000000-0000-0000-0000-00000000000b', 'X', 'Intruso'); ok := false;
  exception when others then ok := true; end;                                     assert ok, 'A no puede insertar con company_id de B';

  begin update public.customers set company_id = 'c0000000-0000-0000-0000-00000000000b' where id = 'd0000000-0000-0000-0000-00000000000a'; ok := false;
  exception when others then ok := true; end;                                     assert ok, 'A no puede mover una fila a B';

  begin insert into public.part_numbers (company_id, customer_id, part_number) values
        ('c0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000b', 'PN-X'); ok := false;
  exception when others then ok := true; end;                                     assert ok, 'FK compuesta: A no puede referenciar un cliente de B';
  raise notice 'OK: aislamiento entre empresas verificado';
end $$;

-- Una empresa suspendida pierde el acceso inmediatamente
reset role;
update public.companies set status = 'suspended' where slug = 'empresa-a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$ declare n int; begin select count(*) into n from public.customers; assert n = 0, 'Empresa suspendida: no debe ver nada'; raise notice 'OK: empresa suspendida sin acceso'; end $$;

-- Anónimo: no ve tablas, solo resolve_company
reset role; set local role anon;
do $$ declare ok boolean; begin
  begin perform 1 from public.customers; ok := false; exception when insufficient_privilege then ok := true; end; assert ok, 'anon no debe leer tablas';
  perform * from public.resolve_company('empresa-b'); raise notice 'OK: anon solo puede resolver el subdominio';
end $$;

rollback;
