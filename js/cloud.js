/* cloud.js — conexión con Supabase (modo "nube"). Si NO existe config.js con SUPABASE_URL y SUPABASE_ANON_KEY, el portal sigue en modo local
   (datos simulados en el navegador) y nada de esto se activa. Con config.js:
     · resuelve la empresa del subdominio con rpc resolve_company
     · inicia sesión con Supabase Auth y verifica la membresía con rpc my_membership (el rol sale SIEMPRE de ahí)
     · convierte G.db en el adaptador de db-cloud.js y llama a las Edge Functions create-company / invite-user / accept-invite
   La llave anon es pública: la seguridad la dan las políticas RLS (ver /Supabase). NUNCA pongas la service_role aquí. */
(function () {
  const G = (window.G = window.G || {});
  const C = (G.Cloud = { enabled: false, client: null, cfg: null });
  const fail = (m, code) => { const e = new Error(m); e.code = code || 'ERR'; return e; };
  C.fail = fail;

  /** config.js (generado en el deploy) se carga como <script> para respetar la CSP (sin eval). Si no existe, modo local. */
  const loadConfig = () => new Promise((res) => { const s = document.createElement('script'); s.src = 'config.js?v=' + Date.now(); s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
  C.init = async () => {
    await loadConfig();
    if (window.GUVEL_READY) { try { await window.GUVEL_READY; } catch (e) { console.error(e); } }   // gancho opcional: config.js puede registrar una carga asíncrona (pruebas)
    const cfg = window.GUVEL_CONFIG; if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return false;
    if (!window.supabase) { console.error('supabase-js did not load; staying in local mode.'); return false; }
    C.cfg = cfg; C.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'guvel_sb_auth' } });
    C.enabled = true; G.CloudDB.install(); return true;
  };

  /* ---------- Errores: códigos de las funciones SQL / Edge Functions → mensajes del portal ---------- */
  const MSG = {
    MACHINE_BUSY: 'This machine already has an active production session.', SESSION_CLOSED: 'This session is no longer active.',
    BAD_QTY: 'Pieces produced must be a whole number, 0 or more.', SCRAP_GT_QTY: 'Scrap cannot exceed the pieces produced.', NO_HOURS: 'There are no hours to consolidate.',
    'not allowed': 'You do not have permission to do that.', 'only an owner can change owners': 'Only an owner can change owners.', 'last owner': 'A company must keep at least one active owner.',
    'only an owner can invite owners': 'Only an owner can invite owners.', 'already a member': 'That person already belongs to this company.'
  };
  C.mapError = (e) => {
    const m = String((e && e.message) || '');
    for (const k of Object.keys(MSG)) if (m.includes(k)) return fail(MSG[k], k.toUpperCase().replace(/[^A-Z]+/g, '_'));
    if (e && (e.code === '23505')) return fail('That value already exists.', 'DUPLICATE');
    if (e && (e.code === '23503')) return fail('This record is used by other records and cannot be deleted.', 'IN_USE');
    if (/permission denied|row-level security|violates row-level/i.test(m)) return fail('You do not have permission to do that.', 'FORBIDDEN');
    if (/Failed to fetch|NetworkError|network/i.test(m)) return fail('Cannot reach the server. Check your connection and try again.', 'NETWORK');
    console.error('Supabase error', e); return fail('Something went wrong. Please try again.', 'ERR');
  };
  C.rpc = async (name, args) => { const { data, error } = await C.client.rpc(name, args); if (error) throw C.mapError(error); return data; };
  /** Llama a una Edge Function; lee el JSON de error ({ error, code }) que devuelven las funciones */
  C.fn = async (name, body) => {
    const { data, error } = await C.client.functions.invoke(name, { body });
    if (error) {
      let j = null; try { j = await error.context.json(); } catch (e) { /* sin cuerpo */ }
      throw fail((j && j.error) || 'Something went wrong. Please try again.', (j && j.code) || 'ERR');
    }
    return data;
  };

  /* ---------- Empresa (subdominio) ---------- */
  C.resolveTenant = async (T) => {
    const loc = T.slugFromLocation(); T.slug = loc.slug; T.source = loc.source;
    if (!loc.slug) { T.state = 'not_found'; return T; }
    let row = null; try { const r = await C.rpc('resolve_company', { p_slug: loc.slug }); row = r && r[0]; } catch (e) { T.state = 'error'; return T; }
    if (!row) { T.state = 'not_found'; return T; }
    T.company = { id: row.id, name: row.name, slug: row.slug, status: row.status, demo: false }; T.platform = !!row.is_platform;
    T.state = row.status === 'active' ? 'ok' : row.status === 'suspended' ? 'suspended' : 'terminated';
    if (T.state === 'ok') { G.db.companyId = row.id; G.db._co = { ...T.company, is_platform: T.platform, demo: false, domain_status: 'active' }; }
    return T;
  };

  /* ---------- Sesión ---------- */
  /** Tras autenticarse: la empresa de ESTE subdominio debe tener una membresía activa del usuario */
  C.afterAuth = async () => {
    const slug = G.Tenant.slug, m = (await C.rpc('my_membership', { p_slug: slug }) || [])[0];
    if (!m) throw fail('This email does not have access to this company.', 'NO_ACCESS');
    const { data: u } = await C.client.auth.getUser(), uid = u.user.id;
    const { data: me } = await C.client.from('memberships').select('first_name,last_name,email').eq('company_id', m.company_id).eq('user_id', uid).maybeSingle();
    const name = me && me.first_name ? `${me.first_name} ${me.last_name || ''}`.trim() : u.user.email.split('@')[0];
    G.user = { email: u.user.email, role: m.role, name, company_slug: slug, id: uid };
    await G.db.hydrate(); G.db.startPolling(); return G.user;
  };
  C.signIn = async (email, password) => {
    const { error } = await C.client.auth.signInWithPassword({ email, password });
    if (error) throw fail('Incorrect email or password.', 'BAD_CREDENTIALS');
    try { return await C.afterAuth(); } catch (e) { await C.client.auth.signOut(); throw e; }
  };
  C.restore = async () => {
    const { data } = await C.client.auth.getSession(); if (!data.session) return null;
    try { return await C.afterAuth(); } catch (e) { await C.client.auth.signOut(); return null; }
  };
  C.signOut = async () => {
    try { G.db.stopPolling(); await C.client.auth.signOut(); } catch (e) { /* ya sin sesión */ }
    const id = G.db.companyId, co = G.db._co; await G.db.init(); G.db.companyId = id; G.db._co = co;     // no dejar datos de la sesión anterior en memoria
    G.Cache.invalidate();
  };
})();
