// _shared/lib.ts — utilidades comunes de las Edge Functions (Deno).
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const BASE_DOMAIN = Deno.env.get('APP_BASE_DOMAIN') ?? 'guvelsystems.com';   // dominio raíz
export const APP_SUBDOMAIN = Deno.env.get('APP_SUBDOMAIN') ?? 'operational';
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);   // p. ej. https://operational.guvelsystems.com,https://operational.metricsworkssaltillo.guvelsystems.com

/** CORS: acepta el origen raíz, cualquier operational.<empresa>.<dominio> y los orígenes extra de ALLOWED_ORIGINS (p. ej. localhost en desarrollo) */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const esc = BASE_DOMAIN.replace(/\./g, '\\.');
  const ok = new RegExp(`^https://${APP_SUBDOMAIN}(\\.[a-z0-9-]+)?\\.${esc}$`).test(origin) || ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null', 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });

/** Error esperado: se devuelve al cliente con su código HTTP y un mensaje seguro */
export class HttpError extends Error { constructor(public status: number, message: string, public code = 'error') { super(message); } }

/** Cliente con la identidad del USUARIO que llama (respeta RLS y auth.uid() dentro de las funciones SQL) */
export function userClient(req: Request): SupabaseClient {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new HttpError(401, 'Sign in first.', 'unauthenticated');
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
}
/** Cliente de servicio (salta RLS). Úsalo solo para lo que el usuario no puede hacer por sí mismo. NUNCA lo devuelvas al navegador. */
export const adminClient = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Token de invitación: 32 bytes aleatorios (hex). En la base solo se guarda su SHA-256. */
export function newToken(): string { const a = crypto.getRandomValues(new Uint8Array(32)); return [...a].map((b) => b.toString(16).padStart(2, '0')).join(''); }
export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Mismas reglas que companies.slug en SQL (0001/0003)
const RESERVED = ['guvel', 'platform', 'www', 'api', 'admin', 'operational', 'app', 'mail', 'static', 'cdn', 'auth'];
export const validSlug = (s: string) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(s) && !RESERVED.includes(s);
export const validEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);
export const hostFor = (slug: string) => `${APP_SUBDOMAIN}.${slug}.${BASE_DOMAIN}`;
export const inviteLink = (slug: string, token: string) => `https://${hostFor(slug)}/#/invite/${token}`;

/** Convierte un error de Postgres/RPC en un HttpError legible (los RAISE EXCEPTION de las funciones SQL) */
export function rpcError(e: { message?: string; code?: string } | null): never {
  const m = e?.message ?? 'Unexpected error';
  if (/not allowed/i.test(m)) throw new HttpError(403, 'You do not have permission to do that.', 'forbidden');
  if (/only an owner/i.test(m)) throw new HttpError(403, 'Only an owner can invite owners.', 'forbidden');
  if (/already a member/i.test(m)) throw new HttpError(409, 'That person already belongs to this company.', 'duplicate');
  if (e?.code === '23505' || /duplicate key/i.test(m)) throw new HttpError(409, 'That address is already taken by another company.', 'duplicate');
  if (e?.code === '23514' || /check constraint/i.test(m)) throw new HttpError(400, 'Invalid data.', 'invalid');
  console.error('rpc error', e); throw new HttpError(500, 'Something went wrong. Please try again.');
}

/** Envuelve un handler: OPTIONS, errores y formato JSON uniformes */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
    if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);
    try { return await handler(req); }
    catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.message, code: e.code }, e.status);
      console.error(e); return json(req, { error: 'Something went wrong. Please try again.' }, 500);
    }
  });
}
