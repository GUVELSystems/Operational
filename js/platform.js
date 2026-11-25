/* platform.js — consola de la EMPRESA MADRE (GUVEL Systems): alta y administración de empresas cliente.
   Solo disponible cuando la empresa activa es la de plataforma (is_platform). Opera sobre companies / memberships / invitations,
   NUNCA sobre datos de producción de las empresas (en Supabase: funciones SECURITY DEFINER platform_*, ver /supabase). */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const fail = (m, code) => { const e = new Error(m); e.code = code; return e; };
  const guard = () => { const c = G.db.company(); if (!c || !c.is_platform || !G.can('companies')) throw fail('Only GUVEL Systems administrators can manage companies.', 'FORBIDDEN'); };
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 40);   // "Metrics Works Saltillo" → metricsworkssaltillo

  const P = (G.Platform = {
    list() { guard(); const d = G.db.data; return d.companies.filter((c) => !c.is_platform).map((c) => ({ ...c, members: d.memberships.filter((m) => m.company_id === c.id && m.status === 'active').length, pending: d.invitations.filter((i) => i.company_id === c.id && i.status === 'pending' && new Date(i.expires_at) >= new Date()).length })); },
    /** Alta: crea la empresa y la invitación de su primer owner. Devuelve { company, invite } */
    async create({ name, slug, ownerEmail, ownerFirst, ownerLast }) {
      guard(); name = String(name || '').trim(); slug = String(slug || '').trim().toLowerCase();
      if (!name) throw fail('Enter the company name.', 'INVALID');
      if (!G.Tenant.slugOk(slug)) throw fail(G.Tenant.reserved.includes(slug) ? 'That address name is reserved.' : 'Use only lowercase letters, numbers and hyphens for the address.', 'INVALID');
      if (G.db.data.companies.some((c) => c.slug === slug)) throw fail('That address is already taken by another company.', 'DUPLICATE');
      if (!/^\S+@\S+\.\S+$/.test(String(ownerEmail || ''))) throw fail('Enter the email of the first owner.', 'INVALID');
      if (G.Cloud.enabled) {   // nube: Edge Function create-company (empresa + invitación + hostname en Cloudflare + correo)
        if (!String(ownerFirst || '').trim() || !String(ownerLast || '').trim()) throw fail('Enter the first name and last name.', 'INVALID');
        const r = await G.Cloud.fn('create-company', { name, slug, ownerEmail, ownerFirstName: ownerFirst, ownerLastName: ownerLast, lang: G.lang });
        await G.db.hydrate(['companies', 'memberships', 'invitations']); G.bus.emit('db:change', { table: 'companies' });
        return { company: { name, slug }, invite: { invite: { email: String(ownerEmail).trim().toLowerCase() }, link: r.inviteLink || null, emailSent: !!r.emailSent }, domain: r.domain };
      }
      const id = U.uid(), company = { id, company_id: id, name, slug, status: 'active', demo: false, is_platform: false, domain_status: 'pending', created_at: new Date().toISOString() };
      G.db.data.companies.push(company);
      const invite = await G.Invites.make(id, ownerEmail, 'owner', G.user.email, { first_name: ownerFirst, last_name: ownerLast }).catch((e) => { G.db.data.companies = G.db.data.companies.filter((c) => c.id !== id); throw e; }); G.db._save(); G.bus.emit('db:change', { table: 'companies' });
      return { company, invite };
    },
    async setStatus(id, status) {
      guard();
      if (G.Cloud.enabled) { await G.Cloud.rpc('platform_set_company_status', { p_company: id, p_status: status }); await G.db.hydrate(['companies']); return G.db.data.companies.find((x) => x.id === id); }
      const c = G.db.data.companies.find((x) => x.id === id); if (!c || c.is_platform) throw fail('Company not found.', 'NOT_FOUND');
      if (!['active', 'suspended', 'terminated'].includes(status)) throw fail('Invalid status.', 'INVALID');
      c.status = status; c.status_changed_at = new Date().toISOString(); G.db._save(); G.bus.emit('db:change', { table: 'companies' }); return c;
    },
    async rename(id, name) { guard(); if (G.Cloud.enabled) { await G.Cloud.rpc('platform_rename_company', { p_company: id, p_name: name }); await G.db.hydrate(['companies']); return true; } const c = G.db.data.companies.find((x) => x.id === id); if (!c || !String(name || '').trim()) throw fail('Enter the company name.', 'INVALID'); c.name = String(name).trim(); G.db._save(); return c; },
    setDomain(id, s) { guard(); const c = G.db.data.companies.find((x) => x.id === id); c.domain_status = s; G.db._save(); return c; },
    /** Nueva invitación para el owner de una empresa (por si se perdió el enlace) */
    async reinviteOwner(id, email, prev) { guard(); return G.Invites.make(id, email, 'owner', G.user.email, prev || {}); }
  });

  const st = { host: null, token: 0 };
  const stBadge = (s) => `<span class="badge ${s === 'active' ? 'run' : s === 'suspended' ? 'watch' : 'stop'}">${s === 'active' ? 'Active' : s === 'suspended' ? 'Suspended' : 'Deactivated'}</span>`;
  const domBadge = (s) => `<span class="badge ${s === 'active' ? 'run' : 'watch'}">${s === 'active' ? 'Address active' : 'Address pending'}</span>`;

  function draw() {
    const host = st.host; if (!host) return;
    try {
      const rows = P.list(), L = G.L, ownerOf = (c) => G.db.data.invitations.filter((i) => i.company_id === c.id && i.role === 'owner').sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      host.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Companies</h3><p class="muted small">${L('Alta, suspensión y baja de empresas cliente. Cada una tiene su propia dirección y sus datos completamente separados.', 'Create, suspend and deactivate client companies. Each one has its own address and fully separated data.')}</p></div><button class="btn primary sm" data-new>${UI.icon('plus', 14)} New company</button></div>
        ${UI.table([{ label: 'Company', render: (c) => `<b>${esc(c.name)}</b><br><span class="muted small">${esc(G.Tenant.hostFor(c.slug).replace(/^https?:\/\//, ''))}</span>` }, { label: 'Status', render: (c) => stBadge(c.status) }, { label: 'Address', render: (c) => domBadge(c.domain_status) },
          { label: 'Users', align: 'right', render: (c) => `${c.members}${c.pending ? ` <span class="muted small">+${c.pending} pending</span>` : ''}` }, { label: 'Created', render: (c) => esc(U.fmtDate(c.created_at.slice(0, 10))) },
          { label: '', align: 'right', render: (c) => `<div class="co-actions"><a class="btn sm" href="${esc(G.Tenant.hostFor(c.slug))}" target="_blank" rel="noopener">${UI.icon('link', 13)} Open</a><button class="btn sm" data-edit="${c.id}">Manage</button></div>` }], rows, { empty: 'No companies yet. Create the first one.' })}</div>
        <div class="panel" style="margin-top:16px"><div class="panel-head"><h3>How a company goes live</h3></div><ol class="steps"><li><b>${L('1. Alta', '1. Create')}</b> — ${L('se registra la empresa y se invita a su primer owner.', 'the company is registered and its first owner is invited.')}</li><li><b>${L('2. Dirección', '2. Address')}</b> — ${L('se crea el subdominio y su certificado (automático en producción).', 'the subdomain and its certificate are created (automatic in production).')}</li><li><b>${L('3. Owner acepta', '3. Owner accepts')}</b> — ${L('abre el enlace, crea su contraseña y entra.', 'opens the link, creates a password and signs in.')}</li><li><b>${L('4. Invita a su equipo', '4. Invites the team')}</b> — ${L('desde el módulo Users de su empresa.', 'from the Users module of their company.')}</li></ol></div>`;
      host.onclick = (e) => { if (e.target.closest('[data-new]')) openNew(); const b = e.target.closest('[data-edit]'); if (b) openManage(b.dataset.edit, ownerOf); };
    } catch (e) { console.error(e); UI.error(host, e, draw); }
  }

  function openNew() {
    const L = G.L, m = UI.modal({ title: 'New company', subtitle: 'GUVEL Systems', size: 'md', body: `<div class="field"><label for="nc-name">Company name</label><input id="nc-name" placeholder="Metrics Works Saltillo" autocomplete="off"></div>
      <div class="field"><label for="nc-slug">Address name</label><div class="slug-row"><span>operational.</span><input id="nc-slug" placeholder="metricsworkssaltillo" autocomplete="off"><span>.${G.Tenant.base}</span></div><span class="hint" id="nc-prev"></span></div>
      <div class="two-col"><div class="field"><label for="nc-of">Owner first name</label><input id="nc-of" autocomplete="off"></div><div class="field"><label for="nc-ol">Owner last name</label><input id="nc-ol" autocomplete="off"></div></div>
      <div class="field"><label for="nc-owner">First owner (email)</label><input id="nc-owner" type="email" placeholder="owner@company.com"><span class="hint">${L('Recibirá un enlace para crear su contraseña y entrar a esta empresa.', 'They will get a link to create their password and sign in to this company.')}</span></div><div class="form-error" id="nc-err" hidden></div>`,
      footer: '<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-create>Create company</button>' });
    const name = $('#nc-name', m.root), slug = $('#nc-slug', m.root), prev = $('#nc-prev', m.root); let touched = false;
    const upd = () => { const s = slug.value.trim().toLowerCase(); prev.textContent = s ? `https://operational.${s}.${G.Tenant.base}` : ''; prev.style.color = !s || G.Tenant.slugOk(s) ? '' : 'var(--neg)'; };
    name.oninput = () => { if (!touched) { slug.value = slugify(name.value); } upd(); }; slug.oninput = () => { touched = true; upd(); };
    $('[data-create]', m.root).onclick = async () => {
      const err = $('#nc-err', m.root);
      try { const r = await P.create({ name: name.value, slug: slug.value, ownerEmail: $('#nc-owner', m.root).value, ownerFirst: $('#nc-of', m.root).value, ownerLast: $('#nc-ol', m.root).value }); m.close(); UI.toast(r.domain === 'error' ? G.L('Empresa creada; el subdominio falló, se puede reintentar', 'Company created; the subdomain failed — it can be retried') : 'Company created'); draw(); G.afterInvite(r.invite, r.company.name); }
      catch (ex) { err.hidden = false; err.textContent = G.t(ex.message); }
    };
    setTimeout(() => name.focus(), 60);
  }

  function openManage(id, ownerOf) {
    const c = P.list().find((x) => x.id === id); if (!c) return; const L = G.L, oi = ownerOf(c);
    const m = UI.modal({ title: c.name, subtitle: G.Tenant.hostFor(c.slug).replace(/^https?:\/\//, ''), size: 'md', body: `<div class="mg-grid"><div><span class="muted small">Status</span><div>${stBadge(c.status)}</div></div><div><span class="muted small">Address</span><div>${domBadge(c.domain_status)}</div></div><div><span class="muted small">Users</span><div><b>${c.members}</b> active · ${c.pending} pending</div></div></div>
      <div class="field"><label for="mg-name">Company name</label><div class="inline"><input id="mg-name" value="${esc(c.name)}"><button class="btn sm" data-rename>Save name</button></div></div>
      ${c.domain_status !== 'active' && !G.Cloud.enabled ? `<div class="mg-box"><b>${L('Dirección pendiente', 'Address pending')}</b><p class="muted small">${L('En producción, el alta crea el subdominio y el certificado en Cloudflare y esta marca cambia sola. En el prototipo la puedes activar a mano.', 'In production, creating the company registers the subdomain and certificate in Cloudflare and this flips on its own. In the prototype you can activate it manually.')}</p><button class="btn sm primary" data-dom>${L('Marcar dirección activa (simulado)', 'Mark address active (simulated)')}</button></div>` : ''}
      <div class="mg-box"><b>${L('Owner', 'Owner')}</b><p class="muted small">${oi ? esc(oi.email) + ' · ' + esc(oi.status) : '—'}</p>${oi && oi.status !== 'accepted' ? `<button class="btn sm" data-reinv>${L('Generar nuevo enlace de invitación', 'Generate a new invitation link')}</button>` : ''}</div>
      <div class="mg-box"><b>${L('Acceso', 'Access')}</b><p class="muted small">${L('Suspender bloquea a todos los usuarios al instante y conserva los datos. Dar de baja es definitivo para el acceso; los datos se conservan para tu archivo.', 'Suspending blocks every user instantly and keeps the data. Deactivating ends access; the data is kept for your records.')}</p><div class="btn-row">${c.status === 'active' ? '<button class="btn sm" data-st="suspended">Suspend</button>' : '<button class="btn sm primary" data-st="active">Reactivate</button>'}${c.status !== 'terminated' ? '<button class="btn sm danger" data-st="terminated">Deactivate</button>' : ''}</div></div>`, footer: '<button class="btn primary" data-close>Done</button>' });
    const done = () => { m.close(); draw(); };
    m.root.onclick = async (e) => {
      try {
        if (e.target.closest('[data-rename]')) { await P.rename(id, $('#mg-name', m.root).value); UI.toast('Name updated'); done(); }
        else if (e.target.closest('[data-dom]')) { P.setDomain(id, 'active'); UI.toast('Address marked active'); done(); }
        else if (e.target.closest('[data-reinv]')) { const r = await P.reinviteOwner(id, oi.email, oi); m.close(); draw(); G.afterInvite(r, c.name); }
        else { const b = e.target.closest('[data-st]'); if (!b) return; const s = b.dataset.st;
          if (s !== 'active' && !(await UI.confirm({ title: s === 'suspended' ? `Suspend ${c.name}?` : `Deactivate ${c.name}?`, message: 'All its users lose access immediately.', confirmLabel: s === 'suspended' ? 'Suspend' : 'Deactivate', danger: true }))) return;
          await P.setStatus(id, s); UI.toast(s === 'active' ? 'Company reactivated' : s === 'suspended' ? 'Company suspended' : 'Company deactivated'); done(); }
      } catch (ex) { UI.toast(UI.errMsg(ex), 'err'); }
    };
  }

  G.Pages.companies = { async render(host) { st.host = host; draw(); }, refresh() { draw(); }, destroy() { st.token++; st.host = null; } };
})();
