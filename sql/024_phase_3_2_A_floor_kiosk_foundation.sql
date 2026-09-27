-- GUVEL Operational — Phase 3.2.A
-- Foundation for "Floor Kiosk" mode: a device fixed at one machine, where an operator identifies
-- themselves by scanning their badge, and a supervisor's PIN is required to start/finish a
-- session, exit the kiosk, or confirm an entry that looks too fast for the part's cycle time.

alter table public.personnel
  add column if not exists badge_code text,
  add column if not exists pin_hash text;

-- One badge code per company (nullable — not every person needs one on day one).
create unique index if not exists ux_personnel_badge_code
  on public.personnel(company_id, badge_code)
  where badge_code is not null;

comment on column public.personnel.badge_code is 'Code printed on/encoded in this person''s badge, scanned to identify them in Floor Kiosk mode.';
comment on column public.personnel.pin_hash is 'Bcrypt hash (pgcrypto) of this person''s PIN. Never read directly by the app — only set_personnel_pin/verify_personnel_pin touch it.';

-- Defense in depth: even though row-level security lets a company member read personnel rows,
-- the pin_hash column itself is not selectable by the app's normal client role at all — only the
-- security-definer functions below (which run with elevated privileges) can touch it.
revoke select (pin_hash) on public.personnel from authenticated, anon;

create extension if not exists pgcrypto;

-- Set or change a person's PIN. Callable by any authenticated member of that person's company
-- (this app has no finer-grained roles yet); the PIN itself never leaves the database.
create or replace function public.set_personnel_pin(p_person_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
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

-- Verify a PIN. Returns true/false only — the hash is never returned to the client.
create or replace function public.verify_personnel_pin(p_person_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
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
