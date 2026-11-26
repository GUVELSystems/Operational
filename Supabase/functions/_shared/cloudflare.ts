// _shared/cloudflare.ts — alta/baja del dominio de una empresa como "Custom Domain" del Worker (mismo patrón que ya usa la app Quality).
// Cloudflare crea solo el registro DNS (tipo Worker) y el certificado de ese hostname, también de dos niveles (operational.<empresa>.guvelsystems.com).
// Variables (secrets de Supabase):
//   CF_API_TOKEN   token con permisos: Account → Workers Scripts: Edit  +  Zone (guvelsystems.com) → DNS: Edit
//   CF_ACCOUNT_ID  id de la cuenta de Cloudflare
//   CF_ZONE_ID     id de la zona guvelsystems.com
//   CF_WORKER_NAME nombre del Worker (por defecto "guveloperational")
// Si falta alguna, el alta de la empresa continúa y el dominio queda "pendiente" (no falla).
const API = 'https://api.cloudflare.com/client/v4';
const cfg = () => {
  const t = Deno.env.get('CF_API_TOKEN'), a = Deno.env.get('CF_ACCOUNT_ID'), z = Deno.env.get('CF_ZONE_ID');
  if (!t || !a || !z) return null;
  return { t, a, z, worker: Deno.env.get('CF_WORKER_NAME') || 'guveloperational' };
};
const call = async (c: { t: string }, path: string, init: RequestInit = {}) => {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${c.t}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`Cloudflare ${r.status}: ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  return j.result;
};

/** Asocia el hostname al Worker (crea DNS + certificado). 'skipped' si Cloudflare no está configurado. */
export async function createHostname(hostname: string): Promise<{ state: 'active' | 'pending' | 'skipped'; id?: string }> {
  const c = cfg(); if (!c) return { state: 'skipped' };
  const r = await call(c, `/accounts/${c.a}/workers/domains`, {
    method: 'PUT',
    body: JSON.stringify({ hostname, service: c.worker, zone_id: c.z, environment: 'production' }),
  });
  return { state: 'active', id: r?.id };   // el certificado se emite en segundos/minutos; la primera visita puede tardar un poco
}
/** Quita el hostname del Worker (al dar de baja definitivamente una empresa). No falla si ya no existe. */
export async function deleteHostname(hostname: string): Promise<void> {
  const c = cfg(); if (!c) return;
  const list = await call(c, `/accounts/${c.a}/workers/domains?hostname=${encodeURIComponent(hostname)}`);
  for (const d of list ?? []) await call(c, `/accounts/${c.a}/workers/domains/${d.id}`, { method: 'DELETE' });
}
