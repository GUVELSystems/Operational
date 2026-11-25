/* tenant.js — multi-empresa: resuelve la empresa por subdominio, valida membresía y bloquea empresas suspendidas / dadas de baja.
   Host de producción:  operational.<empresa>.guvelsystems.com   (slug = segundo nivel)
   Desarrollo (localhost / 127.0.0.1 / file:): ?tenant=<slug> (se recuerda en sessionStorage); por defecto "demo".
   IMPORTANTE: el subdominio solo identifica la empresa en pantalla. La barrera real son las políticas RLS de Supabase (ver /supabase). */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U;
  const BASE = 'guvelsystems.com', APP = 'operational';
  const HOST_RE = new RegExp('^' + APP + '\\.([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\\.' + BASE.replace(/\./g, '\\.') + '$');
  const DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)$/;
  const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  const PLATFORM = 'guvel';                                                           // slug reservado de la empresa madre
  const RESERVED = ['guvel', 'www', 'api', 'admin', 'operational', 'app', 'mail', 'static', 'cdn', 'auth', 'platform'];

  const T = (G.Tenant = { slug: null, company: null, state: 'pending', base: BASE, app: APP });

  /** Slug según el host. En producción NUNCA se acepta ?tenant (solo el subdominio). */
  T.slugFromLocation = (loc = window.location) => {
    const host = String(loc.hostname || '').toLowerCase();
    const m = HOST_RE.exec(host); if (m) return m[1] === PLATFORM ? { slug: null, source: 'host' } : { slug: m[1], source: 'host' };   // la consola de plataforma NO se abre por subdominio de empresa
    if (host === APP + '.' + BASE) return { slug: PLATFORM, source: 'root' };      // operational.guvelsystems.com = empresa madre (GUVEL Systems)
    if (!host || loc.protocol === 'file:' || DEV_HOST.test(host)) {
      let s = null; try { s = new URLSearchParams(loc.search).get('tenant'); if (s) sessionStorage.setItem('guvel_tenant_dev', s); else s = sessionStorage.getItem('guvel_tenant_dev'); } catch (e) { /* sin storage */ }
      s = String(s || 'demo').toLowerCase(); return { slug: SLUG_RE.test(s) ? s : null, source: 'dev' };
    }
    return { slug: null, source: 'unknown' };
  };

  /** Empresas de ejemplo + membresías (migración idempotente). Supabase: tablas companies y memberships. */
  T.seedTenants = (data) => {
    const now = new Date().toISOString(), demo = data.companies[0];
    if (!demo.slug) Object.assign(demo, { slug: 'demo', status: 'active', demo: true });
    if (!data.companies.some((c) => c.is_platform)) { const id = U.uid(); data.companies.push({ id, company_id: id, name: 'GUVEL Systems', slug: PLATFORM, status: 'active', demo: false, is_platform: true, domain_status: 'active', created_at: now }); }
    data.companies.forEach((c) => { if (!c.domain_status) c.domain_status = 'active'; });
    data.companies.forEach((c) => { if (!c.status) c.status = 'active'; });
    const add = (slug, name, status) => { if (data.companies.some((c) => c.slug === slug)) return; const id = U.uid(); data.companies.push({ id, company_id: id, name, slug, status, demo: false, created_at: now }); };
    add('metricsworkssaltillo', 'Metrics Works Saltillo', 'active');
    add('stellantis-suspendida', 'Stellantis (suspended example)', 'suspended');
    add('borgwarner-baja', 'BorgWarner (terminated example)', 'terminated');
    if (!data.memberships) data.memberships = [];
    const co = (slug) => data.companies.find((c) => c.slug === slug), mem = (slug, email, role, first_name, last_name) => { const c = co(slug); if (c && !data.memberships.some((m) => m.company_id === c.id && m.email === email)) data.memberships.push({ id: U.uid(), company_id: c.id, email, first_name, last_name, role, status: 'active', created_at: now }); };
    mem(PLATFORM, 'admin@guvelsystems.demo', 'owner', 'Admin', 'GUVEL');
    mem('metricsworkssaltillo', 'owner@metricsworks.demo', 'owner', 'Owner', 'Metrics Works'); mem('metricsworkssaltillo', 'supervisor@metricsworks.demo', 'supervisor', 'Supervisor', 'Metrics Works');
    data.memberships.forEach((m) => { if (!m.first_name) { const base = m.name || m.email.split('@')[0]; m.first_name = base.split(' ')[0]; m.last_name = m.last_name || base.split(' ').slice(1).join(' '); } });   // migración: nombre y apellido
  };

  /** Equivalente a la función pública resolve_company(slug) de Supabase: solo devuelve id, nombre, slug y estado */
  T.resolve = (db) => {
    const { slug, source } = T.slugFromLocation(); T.slug = slug; T.source = source;
    if (!slug) { T.state = source === 'root' ? 'root' : 'not_found'; return T; }
    const c = db.data.companies.find((x) => x.slug === slug);
    if (!c) { T.state = 'not_found'; return T; }
    T.company = { id: c.id, name: c.name, slug: c.slug, status: c.status, demo: !!c.demo }; T.platform = !!c.is_platform;
    T.state = c.status === 'active' ? 'ok' : c.status === 'suspended' ? 'suspended' : 'terminated';
    if (T.state === 'ok') db.setCompany(c.id);
    return T;
  };

  /** Inicio de sesión: demo = cualquier correo con el rol elegido; resto = el correo debe tener membresía ACTIVA en esta empresa */
  T.signIn = (email, role, password) => {
    if (T.state !== 'ok') throw new Error('This workspace is not active.');
    if (G.Cloud && G.Cloud.enabled) return G.Cloud.signIn(email, password);       // nube: Supabase Auth + membresía (devuelve una promesa)
    const c = G.db.company(), mine = (G.db.data.memberships || []).filter((m) => m.company_id === c.id);
    if (c.demo) return G.Auth.login(email, role, c.slug);
    const m = mine.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.status === 'active');
    if (!m) { const e = new Error('This email does not have access to this company.'); e.code = 'NO_ACCESS'; throw e; }
    return G.Auth.login(email, m.role, c.slug, m.first_name ? `${m.first_name} ${m.last_name || ''}`.trim() : null);
  };
  T.reserved = RESERVED; T.slugOk = (s) => SLUG_RE.test(s) && !RESERVED.includes(s);
  /** Dirección de una empresa: producción = operational.<slug>.guvelsystems.com · desarrollo = ?tenant=<slug> */
  T.hostFor = (slug) => (DEV_HOST.test(location.hostname) || location.protocol === 'file:' ? `${location.origin === 'null' ? '' : location.origin}${location.pathname}?tenant=${slug}` : `https://${APP}.${slug}.${BASE}/`);
  T.demoAccounts =() => { const c = G.db.company(); return c && !c.demo ? (G.db.data.memberships || []).filter((m) => m.company_id === c.id && m.status === 'active') : []; };

  /** Pantalla cuando la empresa no se puede abrir */
  T.blockedScreen = (host) => {
    const L = G.L, name = T.company ? T.company.name : '', st = T.state, UI = G.UI;
    const msg = {
      error: [L('No se pudo conectar', 'Cannot connect'), L('No pudimos contactar al servidor. Revisa tu conexión e inténtalo de nuevo.', 'We could not reach the server. Check your connection and try again.')],
      not_found: [L('Empresa no encontrada', 'Company not found'), L('No existe un espacio de trabajo con esta dirección. Revisa el enlace que te compartió tu administrador.', 'There is no workspace at this address. Check the link your administrator shared with you.')],
      root: [L('Elige tu empresa', 'Choose your company'), L(`Abre la dirección de tu empresa, por ejemplo ${APP}.<empresa>.${BASE}.`, `Open your company address, for example ${APP}.<company>.${BASE}.`)],
      suspended: [L('Espacio suspendido', 'Workspace suspended'), L(`El acceso de ${name} está suspendido temporalmente. Contacta al administrador de tu empresa.`, `Access for ${name} is temporarily suspended. Contact your company administrator.`)],
      terminated: [L('Espacio dado de baja', 'Workspace deactivated'), L(`${name} ya no tiene acceso a GUVEL Operational System. Contacta a GUVEL Systems si es un error.`, `${name} no longer has access to GUVEL Operational System. Contact GUVEL Systems if this is a mistake.`)]
    }[st] || ['', ''];
    host.hidden = false; host.innerHTML = `<div class="login-card signout-card"><div class="brand">${UI.logo()}<span class="brand-text"><b>GUVEL</b><small>OPERATIONAL SYSTEM</small></span></div><h1>${U.esc(msg[0])}</h1><p class="muted">${U.esc(msg[1])}</p><div class="login-lang">${G.langSwitchHTML ? G.langSwitchHTML() : ''}</div></div>`;
    if (G.fitBrand) G.fitBrand();
  };
})();
