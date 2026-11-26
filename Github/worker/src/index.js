// worker/src/index.js — Worker "guvel-operational": sirve la app estática para
//   operational.guvelsystems.com                 → empresa madre (GUVEL Systems)
//   operational.<empresa>.guvelsystems.com       → cada empresa cliente
// El Worker NO decide qué empresa es ni da acceso: solo entrega los archivos de la app. La empresa la resuelve el navegador con Supabase
// (rpc resolve_company) y los datos los protege RLS. Cualquier otro host de la zona pasa tal cual al origen (no se toca nada más).
const HOST = /^operational(?:\.([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))?\.guvelsystems\.com$/;
const RESERVED = new Set(['guvel', 'platform', 'www', 'api', 'admin', 'operational', 'app', 'mail', 'static', 'cdn', 'auth']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = HOST.exec(url.hostname);
    if (!m) return fetch(request);                                   // otros subdominios (www, correo, etc.): comportamiento actual
    if (m[1] && RESERVED.has(m[1])) return new Response('Not found', { status: 404 });   // operational.guvel.… no existe: la madre vive en la raíz

    // Archivos estáticos de la app (index.html, js/, css/, assets/). Las rutas de la app usan #hash, así que no hay rutas de servidor.
    const res = await env.ASSETS.fetch(request);
    // config.js lo genera el deploy con la URL y la llave pública de Supabase: nunca cachearlo
    if (url.pathname === '/config.js') { const r = new Response(res.body, res); r.headers.set('Cache-Control', 'no-store'); return r; }
    return res;
  }
};
