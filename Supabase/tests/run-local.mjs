// run-local.mjs — corre TODAS las migraciones y pruebas SQL en tu PC, sin Docker ni cuenta de Supabase, usando PGlite (Postgres en WASM).
// Uso (una vez):  cd Supabase/tests && npm init -y && npm i @electric-sql/pglite
// Después:        node run-local.mjs
// Simula lo mínimo de Supabase: roles anon/authenticated/service_role, esquema auth (users, uid()) y privilegios por defecto.
// Es una comprobación rápida de lógica y permisos; la CI (ci.yml) repite lo mismo contra un Supabase local real.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const list = (d, re) => fs.readdirSync(path.join(root, d)).filter((f) => re.test(f)).sort().map((f) => path.join(d, f));
const files = [...list('migrations', /\.sql$/), ...list('tests', /\.sql$/)];

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key default gen_random_uuid(), instance_id uuid, aud text, role text, email text unique, encrypted_password text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
let failed = 0;
for (const f of files) {
  const sql = fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, '').replace(/create extension if not exists pgcrypto;/g, '');   // gen_random_uuid() ya viene en PG ≥ 13
  try { await db.exec(sql); console.log('OK  ', f); }
  catch (e) { failed++; console.log('FAIL', f, '\n     ', e.message); break; }
}
console.log(failed ? '\nHay errores.' : '\nTodo en orden: migraciones aplicadas y pruebas de aislamiento, producción e invitaciones superadas.');
process.exit(failed ? 1 : 0);
