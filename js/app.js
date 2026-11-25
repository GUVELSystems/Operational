/* app.js — shell: login simulado, barra superior, router por hash, tema, pantalla completa, preferencias */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, $ = U.$, esc = U.esc;
  G.Pages = G.Pages || {};
  // Navegación: Dashboard · Production · Catalogs (desplegable) · Registers · Settings
  const NAV_CO = [['dashboard', 'Dashboard'], ['production', 'Production'], ['runs', 'Runs'],
    { group: 'catalogs', label: 'Catalogs', icon: 'layers', items: [['customers', 'Customers', 'customers'], ['parts', 'Part Numbers', 'parts'], ['machines', 'Machines', 'machines'], ['personnel', 'Personnel', 'personnel'], ['catalog', 'Scrap & Downtime', 'catalog']] },
    ['registers', 'Registers'], ['notices', 'Notices'], ['settings', 'Settings']];
  const NAV_PLATFORM = [['companies', 'Companies'], ['users', 'Users']];            // empresa madre (GUVEL Systems): solo administración
  /** Navegación según la empresa activa: plataforma = Companies + Users; empresa cliente = módulos + Users (si el rol puede) */
  const navNow = () => { if (G.Tenant.platform) return NAV_PLATFORM; const n = NAV_CO.slice(); if (G.can('users')) n.splice(n.length - 1, 0, ['users', 'Users']); return n; };
  const NAV = NAV_CO;
  const home = () => (G.Tenant.platform ? 'companies' : 'dashboard');
  const pageOk = (id) => (G.Tenant.platform ? ['companies', 'users'].includes(id) : id !== 'companies') && (id !== 'users' || G.can('users'));
  const GROUP_IDS = NAV.filter((n) => n.group).flatMap((n) => n.items.map((i) => i[0]));
  const META = {
    dashboard: ['Dashboard', ''],
    production: ['Production', 'Machine status and production sessions: start a run, log it hour by hour and close it.'],
    customers: ['Customers', 'The companies you build parts for.'],
    parts: ['Part Numbers', 'Parts, their operations, cycle times, linked machines, defects and barcode.'],
    machines: ['Machines', 'Your equipment and the part numbers each machine can run.'],
    catalog: ['Catalog', 'Scrap defects and downtime reasons used when capturing production.'],
    runs: ['Runs', 'One profile per production run: lot, quantities, scrap and downtime.'],
    registers: ['Registers', 'Every production capture, scrap and downtime record, ready to review or export.'],
    personnel: ['Personnel', 'Operators and supervisors available for production sessions.'],
    notices: ['Notices', 'Schedule reports by email: choose what to send, to whom, when, and preview exactly how it will arrive.'],
    settings: ['Settings', 'Shifts that drive Real Time hours and planned time, plus your preferences.'],
    users: ['Users', 'Invite people to this company and control what each one can do.'],
    companies: ['Companies', 'Create, suspend and manage the client companies of GUVEL Operational System.']
  };
  const root = document.documentElement;

  /* ---------- Tema ---------- */
  G.theme = () => (root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  G.setTheme = (t) => {
    root.classList.add('theme-fade'); root.setAttribute('data-theme', t);
    try { localStorage.setItem('guvel_theme', t); } catch (e) { /* sin persistencia */ }
    setTimeout(() => root.classList.remove('theme-fade'), 360);
    G.bus.emit('theme', t);
    const pg = Router.page; if (pg && pg.onTheme) { try { pg.onTheme(); } catch (e) { console.error(e); } }
  };

  /* ---------- Pantalla completa del contenedor de la app ---------- */
  G.isFullscreen = () => !!document.fullscreenElement;
  G.toggleFullscreen = (el) => {
    el = el || $('#app');
    if (document.fullscreenElement) return document.exitFullscreen();
    if (el.requestFullscreen) return el.requestFullscreen().catch(() => UI.toast('Full screen is not available in this browser.', 'err'));
    UI.toast('Full screen is not available in this browser.', 'err');
  };
  document.addEventListener('fullscreenchange', () => {
    const fs = document.fullscreenElement;
    document.body.classList.toggle('is-fs', !!fs && fs.id === 'app');
    const tg = $('#toasts'); if (tg) (fs || document.body).appendChild(tg);
    G.bus.emit('fullscreen', !!fs);
  });

  /* ---------- Router ---------- */
  const Router = (G.Router = {
    page: null, id: null, params: [], token: 0,
    go(path) { if (location.hash === '#/' + path) route(); else location.hash = '#/' + path; },
    allowed() { return true; },
    reload() { return route(); }
  });
  async function route() {
    if (!G.user) return;
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
    let id = parts[0]; if (!G.Pages[id] || !pageOk(id)) id = home();
    const prev = Router.page;
    if (prev && prev.destroy) { try { prev.destroy(); } catch (e) { console.error(e); } }
    if (document.fullscreenElement && document.fullscreenElement.id === 'app') document.exitFullscreen().catch(() => {});
    const tk = ++Router.token, page = G.Pages[id], host = $('#page-host');
    Router.page = page; Router.id = id; Router.params = parts.slice(1);
    closeCatalogs();
    document.querySelectorAll('.nav-item').forEach((n) => { const on = n.dataset.id === id || (n.dataset.group === 'catalogs' && GROUP_IDS.includes(id)); n.classList.toggle('active', on); if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
    document.querySelectorAll('.nav-menu a').forEach((a) => a.classList.toggle('active', a.dataset.id === id));
    const t = $('#page-title'), meta = META[id];
    t.classList.add('swap');
    setTimeout(() => { t.innerHTML = `<div class="eyebrow">GUVEL OPERATIONAL</div><h1>${esc(meta[0])}</h1>${meta[1] ? `<p>${esc(meta[1])}</p>` : ''}`; t.classList.remove('swap'); }, G.Prefs.motion() ? 140 : 0);
    document.title = `${G.L({ dashboard: 'Dashboard', production: 'Producción', runs: 'Corridas', customers: 'Clientes', parts: 'Números de parte', machines: 'Máquinas', catalog: 'Scrap y paros', registers: 'Registros', personnel: 'Personal', notices: 'Avisos', settings: 'Configuración', users: 'Usuarios', companies: 'Empresas' }[id] || meta[0], meta[0])} · GUVEL Operational System`;
    host.innerHTML = UI.skeleton(4);
    try { await page.render(host, Router.params); }
    catch (e) { console.error(e); if (tk === Router.token) UI.error(host, e, route); return; }
    if (tk === Router.token && !page.noStagger) UI.stagger(host);
    G.bus.emit('route', { id, params: Router.params });
  }
  window.addEventListener('hashchange', route);

  /* ---------- Barra superior ---------- */
  function renderTopbar() {
    const co = db.company();
    $('#topbar').innerHTML = `
      <a class="brand" href="#/${home()}" aria-label="GUVEL Operational System — home">${UI.logo()}<span class="brand-text"><b>GUVEL</b><small>OPERATIONAL SYSTEM</small></span></a>
      <nav class="topnav" aria-label="Main navigation">${navNow().map((n) => (n.group
        ? `<button type="button" class="nav-item nav-group" data-group="${n.group}" data-label="${esc(n.label)}" aria-haspopup="menu" aria-expanded="false">${UI.icon(n.icon)}<span class="lbl">${esc(n.label)}</span><span class="chev">${UI.icon('chevron', 14)}</span></button>`
        : `<a class="nav-item" href="#/${n[0]}" data-id="${n[0]}" data-label="${esc(n[1])}">${UI.icon(n[0])}<span class="lbl">${esc(n[1])}</span></a>`)).join('')}</nav>
      <div class="nav-menu" id="nav-menu" role="menu" hidden>${(navNow().filter((n) => n.group)[0] || { items: [] }).items.map(([id, label, ic]) => `<a role="menuitem" href="#/${id}" data-id="${id}">${UI.icon(ic)}<span>${esc(label)}</span></a>`).join('')}</div>
      <div class="top-actions">
        <span class="company-badge" title="Company · role"><span class="co">${esc(co.name)} · </span><span class="role">${esc(G.user.role)}</span></span>
        ${G.langSwitchHTML()}
        <button class="icon-btn theme-toggle" id="btn-theme" data-tip="Switch theme" aria-label="Switch theme"><span class="sun">${UI.icon('sun')}</span><span class="moon">${UI.icon('moon')}</span></button>
        <button class="icon-btn" id="btn-refresh" data-tip="Refresh" aria-label="Refresh">${UI.icon('refresh')}</button>
        <button class="icon-btn" id="btn-logout" data-tip="Logout" aria-label="Logout">${UI.icon('logout')}</button>
      </div>`;
    $('#btn-theme').onclick = () => G.setTheme(G.theme() === 'dark' ? 'light' : 'dark');
    $('#btn-refresh').onclick = async () => {
      const b = $('#btn-refresh'); b.classList.add('spin'); G.Cache.invalidate();
      try { if (G.Cloud.enabled) await db.sync(true); if (Router.page && Router.page.refresh) await Router.page.refresh(); else await route(); UI.toast('Data refreshed'); } finally { b.classList.remove('spin'); }
    };
    $('#btn-logout').onclick = async () => { if (await UI.confirm({ title: 'Log out?', message: 'You will be signed out of GUVEL Operational System on this device.', confirmLabel: 'Log out' })) signOut(); };
    $('#ask-ico').innerHTML = UI.icon('search', 17);
    const gb = $('.nav-group'); if (gb) gb.onclick = (e) => { e.stopPropagation(); toggleCatalogs(); };
    document.body.classList.toggle('is-platform', !!G.Tenant.platform);
    $('#nav-menu').addEventListener('click', () => closeCatalogs());
    G.fitBrand();
  }
  /* ---------- Menú desplegable "Catalogs" (fixed para no recortarse con el scroll de la barra) ---------- */
  function closeCatalogs() { const m = $('#nav-menu'), b = $('.nav-group'); if (m) m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); }
  function toggleCatalogs() {
    const m = $('#nav-menu'), b = $('.nav-group'); if (!m.hidden) return closeCatalogs();
    const r = b.getBoundingClientRect(); m.hidden = false; b.setAttribute('aria-expanded', 'true');
    m.style.left = '8px'; m.style.top = Math.round(r.bottom + 8) + 'px';   // medir con left fijo (si no, el ancho se encoge)
    m.style.left = Math.max(8, Math.min(Math.round(r.left), innerWidth - m.offsetWidth - 8)) + 'px';
    const f = $('a', m); if (f) f.focus();
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.nav-menu,.nav-group')) closeCatalogs(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCatalogs(); });
  window.addEventListener('resize', () => { closeCatalogs(); G.fitBrand(); });
  /** Ajusta "OPERATIONAL SYSTEM" para que ocupe exactamente el ancho de "GUVEL" */
  G.fitBrand = () => {
    U.$$('.brand-text').forEach((bt) => {
      const b = $('b', bt), s = $('small', bt); if (!b || !s || !b.offsetWidth) return;
      s.style.letterSpacing = '0px'; s.style.marginRight = '0px';
      const ls = parseFloat(getComputedStyle(b).letterSpacing) || 0, target = b.getBoundingClientRect().width - ls, natural = s.getBoundingClientRect().width, n = s.textContent.length;
      const sp = (target - natural) / Math.max(1, n - 1); s.style.letterSpacing = sp.toFixed(2) + 'px'; s.style.marginRight = (-sp).toFixed(2) + 'px';
    });
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => G.fitBrand());

  /* ---------- Login / sign-out ---------- */
  function showLogin() {
    $('#app').hidden = true; const s = $('#login-screen'); s.hidden = false;
    s.innerHTML = `<form class="login-card" id="login-form" novalidate><div class="login-lang">${G.langSwitchHTML()}</div>
      <div class="brand">${UI.logo()}<span class="brand-text"><b>GUVEL</b><small>OPERATIONAL SYSTEM</small></span></div>
      <div><h1>Welcome back</h1></div><p class="muted">Sign in to see what your plant is doing right now.</p>
      <div class="tenant-chip" data-notr>${UI.icon('layers', 14)} ${esc(db.company().name)}</div>
      <div class="field"><label for="lg-email">Email</label><input id="lg-email" type="email" autocomplete="username" placeholder="you@company.com" value=""></div>
      <div class="field"><label for="lg-pass">Password</label><input id="lg-pass" type="password" autocomplete="current-password" placeholder="${G.Cloud.enabled ? '' : 'Any password works in this prototype'}"></div>
      ${db.company().demo ? `<div class="field"><label for="lg-role">Role (demo)</label><select id="lg-role">${G.ROLES.map((r) => `<option value="${r}"${r === 'owner' ? ' selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('')}</select><span class="hint">Pick a role to try the permission levels.</span></div>`
        : G.Cloud.enabled ? '' : `<p class="hint">Your role comes from your company membership. Prototype accounts: ${G.Tenant.demoAccounts().map((m) => `<b data-notr>${esc(m.email)}</b> (${esc(m.role)})`).join(', ') || '—'}</p>`}
      <div class="form-error" id="lg-err" hidden></div>
      <button class="btn primary" type="submit" style="height:46px">Sign in</button></form>`;
    $('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const email = $('#lg-email').value.trim() || (db.company().demo ? 'demo@guvel.com' : ''), err = $('#lg-err'), roleEl = $('#lg-role');
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.hidden = false; err.textContent = G.L('Ingresa un correo válido.', 'Please enter a valid email address.'); return; }
      const btn = $('#login-form button[type=submit]'); btn.disabled = true;
      try { await G.Tenant.signIn(email, roleEl ? roleEl.value : null, $('#lg-pass').value); }
      catch (ex) { btn.disabled = false; err.hidden = false; err.textContent = ex.code === 'NO_ACCESS' ? G.L('Este correo no tiene acceso a esta empresa.', 'This email does not have access to this company.') : ex.code === 'BAD_CREDENTIALS' ? G.L('Correo o contraseña incorrectos.', 'Incorrect email or password.') : ex.code === 'NETWORK' ? G.L('No se pudo conectar. Revisa tu conexión.', 'Cannot connect. Check your connection.') : G.L('Este espacio no está activo.', 'This workspace is not active.'); return; }
      enterApp();
    };
    G.fitBrand(); setTimeout(() => $('#lg-email') && $('#lg-email').focus(), 50);
  }
  function signOut() {
    G.Auth.logout(); if (G.Cloud.enabled) G.Cloud.signOut(); $('#app').hidden = true; const s = $('#login-screen'); s.hidden = false;
    G.bus.emit('logout');
    s.innerHTML = `<div class="login-card signout-card"><div id="shatter-host"></div><h1>See you soon</h1><p class="muted">Your data stays on this device. Ramiro AI will be right here when you come back.</p><button class="btn primary" id="back-in" style="height:46px">Sign back in</button></div>`;
    const stopShatter = G.logoShatter($('#shatter-host'));
    $('#back-in').onclick = () => { stopShatter(); showLogin(); }; $('#back-in').focus();
    if (Router.page && Router.page.destroy) { try { Router.page.destroy(); } catch (e) { /* ignora */ } } Router.page = null;
    history.replaceState(null, '', location.pathname);
  }
  function enterApp() {
    $('#login-screen').hidden = true; $('#login-screen').innerHTML = ''; $('#app').hidden = false;
    renderTopbar(); G.bus.emit('login', G.user);
    if (!location.hash || location.hash === '#' || /^#\/invite\//.test(location.hash)) location.hash = '#/' + home(); else route();
  }
  G.enterApp = enterApp; G.showLogin = showLogin;

  /* ---------- Búsqueda global → Ramiro ---------- */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && G.user) { e.preventDefault(); const i = $('#ask-input'); if (i) i.focus(); }
  });
  document.addEventListener('submit', (e) => { if (e.target.closest('.ask-box')) e.preventDefault(); });
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'ask-input' && e.key === 'Enter') { const q = e.target.value.trim(); e.target.value = ''; e.target.blur(); if (G.Ramiro) G.Ramiro.open(q || ''); }
  });

  /* ---------- Preferencias (se muestra en Settings) ---------- */
  G.renderPrefs = (host) => {
    const p = G.Prefs.s;
    host.innerHTML = `<div class="panel"><div class="panel-head"><h2>Preferences</h2></div>
      <div class="pref-row"><div><b>Language</b><p class="muted small">Changes the whole portal, Ramiro AI and the emails of your notices.</p></div>${G.langSwitchHTML()}</div>
      <div class="pref-row"><div><b>Reduce motion</b><p class="muted small">Makes transitions instant and keeps Ramiro AI still.</p></div><label class="switch"><input type="checkbox" id="pf-motion" ${p.reduceMotion ? 'checked' : ''} aria-label="Reduce motion"><i></i></label></div>
      <div class="pref-row"><div><b>Live updates</b><p class="muted small">Auto-refresh Plant Now and the machine panel every 60 seconds.</p></div><label class="switch"><input type="checkbox" id="pf-live" ${p.live ? 'checked' : ''} aria-label="Live updates"><i></i></label></div>
      <div class="pref-row"><div><b>Neon cursor</b><p class="muted small">A soft sky-blue glowing circle that follows your mouse and fades after 10 seconds without moving.</p></div><label class="switch"><input type="checkbox" id="pf-cursor" ${p.cursor !== false ? 'checked' : ''} aria-label="Neon cursor"><i></i></label></div>
      ${db.company().demo ? `<div class="pref-row"><div><b>Demo data</b><p class="muted small">Restore the original sample data (clears your changes on this device).</p></div><button class="btn danger sm" id="pf-reset">Reset demo data</button></div>` : ''}
      ${G.Cloud.enabled ? '' : '<div class="pref-row"><div><b>Company isolation test</b><p class="muted small">Checks that this company cannot read, change, delete or reference data from any other company.</p></div><button class="btn sm" id="pf-iso">Run test</button></div>'}</div>
      <div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Role permissions <span class="chip">Proposed</span></h2></div>
      <p class="muted small" style="margin-bottom:10px">Matrix proposed for this prototype — to be validated against the real Supabase RLS policies.</p>
      ${UI.table([{ label: 'Permission', render: (r) => esc(G.PERM_LABELS[r]) }].concat(G.ROLES.map((ro) => ({ label: ro, align: 'right', render: (r) => (G.PERMS[ro][r] ? UI.icon('check', 16) : '<span class="muted">—</span>') }))), Object.keys(G.PERM_LABELS))}</div>`;
    $('#pf-motion', host).onchange = (e) => G.Prefs.set('reduceMotion', e.target.checked);
    $('#pf-live', host).onchange = (e) => G.Prefs.set('live', e.target.checked);
    $('#pf-cursor', host).onchange = (e) => G.Prefs.set('cursor', e.target.checked);
    const iso = $('#pf-iso', host); if (iso) iso.onclick = () => G.Tenant.runIsolationTest();
    const rst = $('#pf-reset', host); if (rst) rst.onclick = async () => { if (await UI.confirm({ title: 'Reset demo data?', message: 'All captures, sessions and edits you made on this device will be replaced by the original sample data.', confirmLabel: 'Reset', danger: true })) { db.reset(); G.Cache.invalidate(); G.bus.emit('db:change', { table: 'production_captures' }); UI.toast('Demo data restored'); route(); } };
  };

  /* ---------- Idioma (EN / ES): selector y re-pintado ---------- */
  G.langSwitchHTML = () => `<div class="lang-switch" role="group" aria-label="Language" data-notr><button type="button" data-lang="en" class="${G.lang === 'en' ? 'active' : ''}" aria-pressed="${G.lang === 'en'}" title="English">EN</button><button type="button" data-lang="es" class="${G.lang === 'es' ? 'active' : ''}" aria-pressed="${G.lang === 'es'}" title="Español">ES</button></div>`;
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) G.setLang(b.dataset.lang); });
  const staticText = () => {   // textos fijos de index.html
    const i = $('#ask-input'); if (i) i.placeholder = G.L('Pregúntale a Ramiro AI...', 'Search or ask Ramiro AI...');
    const l = $('.ask-box .sr-only'); if (l) l.textContent = G.L('Buscar o preguntar a Ramiro AI', 'Search or ask Ramiro AI');
  };
  G.bus.on('lang', () => {
    staticText();
    if (G.Tenant.state !== 'ok') G.Tenant.blockedScreen($('#login-screen'));
    else if (G.user) { renderTopbar(); route(); } else if (!$('#login-screen').hidden) showLogin();
    if (G.Ramiro && G.Ramiro.resetLang) G.Ramiro.resetLang();
  });

  /* ---------- Arranque ---------- */
  (async function boot() {
    const cloud = await G.Cloud.init();                                                   // ¿hay config.js con Supabase? si no: modo local
    try { await db.init(); } catch (e) { console.error(e); }
    if (cloud) await G.Cloud.resolveTenant(G.Tenant); else G.Tenant.resolve(db);
    staticText();
    if (G.Tenant.state !== 'ok') { $('#app').hidden = true; G.Tenant.blockedScreen($('#login-screen')); return; }   // empresa inexistente / suspendida / dada de baja
    const inv = /^#\/invite\/([a-f0-9]{16,})$/.exec(location.hash);                       // enlace de invitación: va ANTES del login
    if (inv) { G.Auth.logout(); if (cloud) await G.Cloud.signOut(); G.showInvite(inv[1]); return; }
    if (cloud ? await G.Cloud.restore() : G.Auth.load()) enterApp(); else showLogin();
  })();
})();
