-- GUVEL Operational — Phase 3.2.B
-- Fix: "function gen_salt(unknown) does not exist"
--
-- Supabase installs pgcrypto into its own `extensions` schema, not `public`. The previous
-- migration's functions pinned `search_path = public`, so the unqualified calls to gen_salt()
-- and crypt() inside them could not find pgcrypto at all. This widens the search_path to check
-- both schemas, whichever one pgcrypto actually ended up in.

create extension if not exists pgcrypto;

create or replace function public.set_personnel_pin(p_person_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin is null or length(p_pin) < 4 then
    raise exception 'PIN must be at least 4 characters.';
  end if;
  update public.personnel
    set pin_hash = crypt(p_pin, gen_salt('bf')), updated_at = now()
    where id = p_person_id
      and is_company_member(company_id);
  if not found then
    raise exception 'Person not found or not in your company.';
  end if;
end;
$$;

create or replace function public.verify_personnel_pin(p_person_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text; v_company uuid;
begin
  select pin_hash, company_id into v_hash, v_company from public.personnel where id = p_person_id;
  if v_hash is null or v_company is null or not is_company_member(v_company) then
    return false;
  end if;
  return v_hash = crypt(p_pin, v_hash);
end;
$$;

grant execute on function public.set_personnel_pin(uuid, text) to authenticated;
grant execute on function public.verify_personnel_pin(uuid, text) to authenticated;
