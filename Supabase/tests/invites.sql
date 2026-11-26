-- invites.sql — empresa madre, alta de empresas e invitaciones con token. Termina en ROLLBACK.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'root@guvel.test'),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nobody@x.test'),
  ('33333333-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new@magna.test'),
  ('44444444-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@x.test');
insert into public.companies (id, name, slug, is_platform, domain_status) values ('c0000000-0000-0000-0000-0000000000f0', 'GUVEL Systems', 'guvel', true, 'active');
insert into public.memberships (company_id, user_id, role, first_name, last_name, email) values ('c0000000-0000-0000-0000-0000000000f0', '11111111-0000-0000-0000-000000000001', 'owner', 'Root', 'Admin', 'root@guvel.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-000000000002","role":"authenticated"}', true);   -- un usuario cualquiera
do $$ declare ok boolean; begin
  begin perform public.platform_create_company('X', 'x-co', 'a@b.co', 'A', 'B', 'hash-x'); ok := false; exception when others then ok := sqlerrm = 'not allowed'; end; assert ok, 'solo admins de plataforma crean empresas';
  begin perform public.platform_set_company_status('c0000000-0000-0000-0000-0000000000f0', 'suspended'); ok := false; exception when others then ok := sqlerrm = 'not allowed'; end; assert ok, 'solo admins de plataforma suspenden';
end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}', true);   -- admin de plataforma
do $$ declare v_id uuid; ok boolean; n int; r record; v_role public.member_role; begin
  v_id := public.platform_create_company('Magna Ramos', 'magna', 'New@Magna.test', 'Ana', 'Magna', 'hash-owner');
  select count(*) into n from public.companies; assert n >= 2, 'el admin de plataforma ve las empresas';
  begin perform public.platform_create_company('Otra', 'magna', 'z@z.co', 'Z', 'Z', 'h2'); ok := false; exception when others then ok := true; end; assert ok, 'slug duplicado rechazado';
  begin perform public.platform_create_company('Mala', 'guvel', 'z@z.co', 'Z', 'Z', 'h3'); ok := false; exception when others then ok := true; end; assert ok, 'slug reservado rechazado';
  begin perform public.platform_create_company('Mala', 'Bad_Slug', 'z@z.co', 'Z', 'Z', 'h4'); ok := false; exception when others then ok := true; end; assert ok, 'slug inválido rechazado';
  select count(*) into n from public.customers; assert n = 0, 'el admin de plataforma NO ve datos de producción';
  raise notice 'OK: alta de empresa';
end $$;

-- Pantalla de aceptación (anónimo): estados del token
reset role; set local role anon;
do $$ declare r record; ok boolean; begin
  select * into r from public.get_invitation('magna', 'hash-owner'); assert r.state = 'ok' and r.email = 'new@magna.test' and r.first_name = 'Ana', 'token válido en su empresa';
  assert not exists (select 1 from public.get_invitation('guvel', 'hash-owner')), 'el token no sirve en el subdominio de otra empresa';
  assert not exists (select 1 from public.get_invitation('magna', 'otro-hash')), 'token inexistente';
  begin perform 1 from public.invitations; ok := false; exception when insufficient_privilege then ok := true; end; assert ok, 'anon no lee invitaciones';
  begin perform public.consume_invitation('magna', 'hash-owner', '33333333-0000-0000-0000-000000000003', 'A', 'B'); ok := false; exception when insufficient_privilege then ok := true; end; assert ok, 'anon no puede consumir';
end $$;

-- Consumir: solo service_role
reset role; set local role service_role;
do $$ declare ok boolean; v_role public.member_role; r record; begin
  begin perform public.consume_invitation('magna', 'hash-owner', '44444444-0000-0000-0000-000000000004', 'X', 'Y'); ok := false; exception when others then ok := sqlerrm = 'email mismatch'; end; assert ok, 'el correo debe coincidir con la invitación';
  begin perform public.consume_invitation('guvel', 'hash-owner', '33333333-0000-0000-0000-000000000003', 'A', 'B'); ok := false; exception when others then ok := sqlerrm = 'invalid invitation'; end; assert ok, 'otra empresa no puede consumirla';
  v_role := public.consume_invitation('magna', 'hash-owner', '33333333-0000-0000-0000-000000000003', 'Ana', 'Magna'); assert v_role = 'owner', 'rol owner'; assert (select email from public.memberships where user_id = '33333333-0000-0000-0000-000000000003') = 'new@magna.test', 'email guardado en la membresía';
  begin perform public.consume_invitation('magna', 'hash-owner', '33333333-0000-0000-0000-000000000003', 'Ana', 'Magna'); ok := false; exception when others then ok := true; end; assert ok, 'un token solo se usa una vez';
  select * into r from public.get_invitation('magna', 'hash-owner'); assert r.state = 'used', 'estado used';
  raise notice 'OK: aceptación de invitación';
end $$;

-- El nuevo owner de Magna invita a su gente; solo ve lo suyo
reset role; set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ declare id1 uuid; ok boolean; n int; magna uuid; begin
  select id into magna from public.companies where slug = 'magna';
  id1 := public.create_invitation(magna, 'Sup@Magna.test', 'Sara', 'Sup', 'supervisor', 'hash-sup'); assert id1 is not null, 'owner invita';
  id1 := public.create_invitation(magna, 'sup@magna.test', 'Sara', 'Sup', 'supervisor', 'hash-sup2');
  select count(*) into n from public.invitations where email = 'sup@magna.test' and status = 'pending'; assert n = 1, 'una sola invitación vigente por correo (la anterior se revoca)';
  begin perform public.create_invitation(magna, 'new@magna.test', 'A', 'B', 'guest', 'hash-dup'); ok := false; exception when others then ok := sqlerrm = 'already a member'; end; assert ok, 'no se invita a un miembro existente';
  begin perform public.create_invitation('c0000000-0000-0000-0000-0000000000f0', 'z@z.co', 'Z', 'Z', 'guest', 'hash-z'); ok := false; exception when others then ok := sqlerrm = 'not allowed'; end; assert ok, 'no puede invitar a otra empresa';
  select count(*) into n from public.companies; assert n = 1, 'solo ve su empresa';
  perform public.revoke_invitation(id1); select count(*) into n from public.invitations where status = 'pending'; assert n = 0, 'revocada';
  raise notice 'OK: invitaciones de una empresa';
end $$;

-- Suspender corta el acceso
reset role; set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ begin perform public.platform_set_company_status((select id from public.companies where slug = 'magna'), 'suspended'); end $$;
select set_config('request.jwt.claims', '{"sub":"33333333-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ declare n int; begin select count(*) into n from public.companies; assert n = 0, 'empresa suspendida: sin acceso'; raise notice 'OK: suspensión'; end $$;
rollback;
