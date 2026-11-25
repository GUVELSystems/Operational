/* users.js — módulo Users: invitaciones con token por empresa + gestión de miembros, y pantalla de aceptación del enlace.
   Token: 32 bytes aleatorios; en la base solo se guarda su SHA-256 (nunca el token), caduca a los 7 días y es de un solo uso.
   El enlace apunta al subdominio de LA empresa; al aceptarlo se crea la membresía. En Supabase: Edge Function accept-invite (ver /supabase). */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$, DAYS = 7;

  const sha = async (s) => {
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
    catch (e) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'weak' + (h >>> 0).toString(16); }   // solo si el navegador no ofrece crypto.subtle
  };
  const rndToken = () => { const a = new Uint8Array(32); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256))); return Array.from(a).map((x) => x.toString(16).padStart(2, '0')).join(''); };
  const fail = (m, code) => { const e = new Error(m); e.code = code; return e; };

  const Inv = (G.Invites = {
    DAYS,
    /** Crea una invitación para una empresa (cualquiera: la usa también la consola de plataforma). Devuelve { invite, token, link } */
    async make(companyId, email, role, by, names = {}) {
      if (G.Cloud.enabled) {   // nube: Edge Function invite-user (genera el token, guarda solo su hash y envía el correo)
        const first = String(names.first_name || '').trim(), last = String(names.last_name || '').trim();
        if (!first || !last) throw fail('Enter the first name and last name.', 'INVALID');
        const r = await G.Cloud.fn('invite-user', { companyId, email, firstName: first, lastName: last, role, lang: G.lang });
        await G.db.hydrate(['invitations']);
        return { invite: { email: String(email).trim().toLowerCase(), role, first_name: first, last_name: last }, token: null, link: r.inviteLink || null, emailSent: !!r.emailSent };
      }
      const d = G.db.data, co = d.companies.find((c) => c.id === companyId); if (!co) throw fail('Company not found.', 'NOT_FOUND');
      const first_name = String(names.first_name || '').trim(), last_name = String(names.last_name || '').trim();
      if (!first_name || !last_name) throw fail('Enter the first name and last name.', 'INVALID');
      email = String(email || '').trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) throw fail('Enter a valid email address.', 'INVALID');
      if (!G.ROLES.includes(role)) throw fail('Choose a role.', 'INVALID');
      if (d.memberships.some((m) => m.company_id === companyId && m.email.toLowerCase() === email && m.status !== 'disabled')) throw fail('That person already belongs to this company.', 'DUPLICATE');
      d.invitations.forEach((i) => { if (i.company_id === companyId && i.email === email && i.status === 'pending') i.status = 'revoked'; });   // una sola invitación vigente por correo
      const token = rndToken(), now = new Date(), invite = { id: U.uid(), company_id: companyId, email, first_name, last_name, role, token_hash: await sha(token), status: 'pending', invited_by: by || null, expires_at: new Date(now.getTime() + DAYS * 864e5).toISOString(), created_at: now.toISOString(), accepted_at: null };
      d.invitations.push(invite); G.db._save(); G.bus.emit('db:change', { table: 'invitations' });
      return { invite, token, link: Inv.link(co.slug, token) };
    },
    link(slug, token) { const base = G.Tenant.hostFor(slug); return `${base}${base.includes('?') ? '' : ''}#/invite/${token}`; },
    /** Valida un token para la empresa de ESTE subdominio. Devuelve { invite, company } o lanza con code: INVALID | USED | REVOKED | EXPIRED | WRONG_COMPANY */
    async check(token) {
      if (G.Cloud.enabled) {   // nube: función pública get_invitation(slug, hash) — solo devuelve lo necesario y únicamente si el token es de ESTA empresa
        const rows = await G.Cloud.rpc('get_invitation', { p_slug: G.Tenant.slug, p_token_hash: await sha(String(token || '')) }), r = rows && rows[0];
        if (!r) throw fail('This invitation link is not valid.', 'INVALID');
        if (r.state === 'used') throw fail('This invitation was already used.', 'USED');
        if (r.state === 'revoked') throw fail('This invitation was cancelled.', 'REVOKED');
        if (r.state === 'expired') throw fail('This invitation has expired.', 'EXPIRED');
        return { invite: { email: r.email, role: r.role, first_name: r.first_name, last_name: r.last_name }, company: { name: r.company_name } };
      }
      const d = G.db.data, h = await sha(String(token || '')), inv = d.invitations.find((i) => i.token_hash === h);
      if (!inv) throw fail('This invitation link is not valid.', 'INVALID');
      if (inv.company_id !== G.db.companyId) throw fail('This invitation belongs to another company.', 'WRONG_COMPANY');
      if (inv.status === 'accepted') throw fail('This invitation was already used.', 'USED');
      if (inv.status === 'revoked') throw fail('This invitation was cancelled.', 'REVOKED');
      if (new Date(inv.expires_at) < new Date()) throw fail('This invitation has expired.', 'EXPIRED');
      return { invite: inv, company: G.db.company() };
    },
    /** Acepta: crea la membresía (o la reactiva), marca la invitación como usada e inicia sesión */
    async accept(token, { first_name, last_name, password }) {
      const { invite } = await Inv.check(token);
      first_name = String(first_name || '').trim(); last_name = String(last_name || '').trim();
      if (!first_name || !last_name) throw fail('Enter the first name and last name.', 'INVALID');
      if (String(password || '').length < 8) throw fail('Use at least 8 characters for the password.', 'INVALID');   // prototipo: la contraseña no se guarda
      if (G.Cloud.enabled) {   // nube: Edge Function accept-invite (crea la cuenta y la membresía) + inicio de sesión
        const C = G.Cloud, body = { slug: G.Tenant.slug, token, password, firstName: first_name, lastName: last_name };
        let r = await C.fn('accept-invite', body);
        if (r && r.existingUser) {   // ese correo ya tiene cuenta (p. ej. de otra empresa): se usa SU contraseña actual para demostrar que es suyo
          const si = await C.client.auth.signInWithPassword({ email: invite.email, password });
          if (si.error) throw fail('This email already has an account. Enter your current password to join.', 'EXISTING_USER');
          r = await C.fn('accept-invite', body);
        } else { const si = await C.client.auth.signInWithPassword({ email: invite.email, password }); if (si.error) throw fail('Something went wrong. Please try again.', 'ERR'); }
        return C.afterAuth();
      }
      const d = G.db.data; let m = d.memberships.find((x) => x.company_id === invite.company_id && x.email.toLowerCase() === invite.email);
      if (m) Object.assign(m, { role: invite.role, status: 'active', first_name, last_name }); else d.memberships.push({ id: U.uid(), company_id: invite.company_id, email: invite.email, first_name, last_name, role: invite.role, status: 'active', created_at: new Date().toISOString() });
      invite.status = 'accepted'; invite.accepted_at = new Date().toISOString(); G.db._save();
      return G.Auth.login(invite.email, invite.role, G.db.company().slug, `${first_name} ${last_name}`);
    }
  });

  /* ---------- Pantalla de aceptación (antes de iniciar sesión) ---------- */
  G.showInvite = async (token) => {
    const s = $('#login-screen'), L = G.L; $('#app').hidden = true; s.hidden = false;
    const shell = (inner) => (s.innerHTML = `<div class="login-card"><div class="login-lang">${G.langSwitchHTML()}</div><div class="brand">${UI.logo()}<span class="brand-text"><b>GUVEL</b><small>OPERATIONAL SYSTEM</small></span></div>${inner}</div>`);
    let chk; try { chk = await Inv.check(token); } catch (e) {
      shell(`<h1>${L('Invitación no disponible', 'Invitation unavailable')}</h1><p class="muted">${esc(G.t(e.message))}</p><p class="muted small">${L('Pide a un administrador de tu empresa que te envíe una invitación nueva.', 'Ask an administrator of your company to send you a new invitation.')}</p><button class="btn primary" id="inv-go" style="height:46px">${L('Ir al inicio de sesión', 'Go to sign in')}</button>`);
      $('#inv-go').onclick = () => { history.replaceState(null, '', location.pathname + location.search); G.showLogin(); }; G.fitBrand(); return;
    }
    const { invite, company } = chk;
    shell(`<form id="inv-form" novalidate><div><h1>${L('Únete a', 'Join')} ${esc(company.name)}</h1></div><p class="muted">${L('Te invitaron con el rol', 'You were invited as')} <b>${esc(invite.role)}</b>. ${L('Crea tu contraseña para entrar.', 'Create your password to get in.')}</p>
      <div class="field"><label>Email</label><input type="email" value="${esc(invite.email)}" readonly></div>
      <div class="two-col"><div class="field"><label for="iv-first">${L('Nombre', 'First name')}</label><input id="iv-first" autocomplete="given-name" value="${esc(invite.first_name || '')}"></div><div class="field"><label for="iv-last">${L('Apellido', 'Last name')}</label><input id="iv-last" autocomplete="family-name" value="${esc(invite.last_name || '')}"></div></div>
      <div class="field"><label for="iv-p1">${L('Contraseña', 'Password')}</label><input id="iv-p1" type="password" autocomplete="new-password" placeholder="${L('Mínimo 8 caracteres', 'At least 8 characters')}"></div>
      <div class="field"><label for="iv-p2">${L('Repite la contraseña', 'Repeat the password')}</label><input id="iv-p2" type="password" autocomplete="new-password"></div>
      <div class="form-error" id="iv-err" hidden></div><button class="btn primary" type="submit" style="height:46px">${L('Crear cuenta y entrar', 'Create account and sign in')}</button></form>`);
    $('#inv-form').onsubmit = async (e) => {
      e.preventDefault(); const err = $('#iv-err'), p1 = $('#iv-p1').value;
      if (p1 !== $('#iv-p2').value) { err.hidden = false; err.textContent = L('Las contraseñas no coinciden.', 'The passwords do not match.'); return; }
      try { await Inv.accept(token, { first_name: $('#iv-first').value, last_name: $('#iv-last').value, password: p1 }); } catch (ex) { err.hidden = false; err.textContent = G.t(ex.message); return; }
      history.replaceState(null, '', location.pathname + location.search); G.enterApp();
    };
    G.fitBrand(); setTimeout(() => $('#iv-first') && $('#iv-first').focus(), 50);
  };

  /** Operaciones sobre miembros/invitaciones: en la nube pasan por funciones SQL con sus reglas (admin no toca owners, último owner, etc.) */
  const api = {
    async role(id, role) { if (G.Cloud.enabled) { await G.Cloud.rpc('set_member_role', { p_membership: id, p_role: role }); await G.db.hydrate(['memberships']); } else await G.db.update('memberships', id, { role }); },
    async status(id, status) { if (G.Cloud.enabled) { await G.Cloud.rpc('set_member_status', { p_membership: id, p_status: status }); await G.db.hydrate(['memberships']); } else await G.db.update('memberships', id, { status }); },
    async revoke(id) { if (G.Cloud.enabled) { await G.Cloud.rpc('revoke_invitation', { p_invitation: id }); await G.db.hydrate(['invitations']); } else await G.db.update('invitations', id, { status: 'revoked' }); }
  };
  /** Tras invitar: si el servidor devolvió el enlace (porque el correo no salió) o estamos en modo local, se muestra; si no, ya se envió por correo */
  G.afterInvite = (r, coName) => { if (r.link) G.showInviteLink(r, r.invite.email, coName); else UI.toast(G.L('Invitación enviada por correo', 'Invitation sent by email')); };

  /* ---------- Página Users ---------- */
  const st = { host: null, token: 0 };
  const ROLE_NOTE = { owner: 'Full control of the company, including users', admin: 'Everything except changing owners', manager: 'Operations, catalogs and notices', supervisor: 'Capture production and run sessions', guest: 'Read-only' };
  const fmtD = (iso) => U.fmtDate(String(iso).slice(0, 10));

  async function draw() {
    const host = st.host; if (!host) return; const db = G.db, tk = ++st.token;
    try {
      const [mem, inv] = await Promise.all([db.select('memberships', { order: [['created_at', 'asc']] }), db.select('invitations', { order: [['created_at', 'desc']] })]);
      if (tk !== st.token) return;
      const me = (G.user.email || '').toLowerCase(), isOwner = G.user.role === 'owner', pend = inv.filter((i) => i.status === 'pending' && new Date(i.expires_at) >= new Date()), past = inv.filter((i) => !pend.includes(i));
      const canTouch = (m) => m.email.toLowerCase() !== me && (isOwner || m.role !== 'owner');
      const roleSel = (m) => canTouch(m) ? `<select class="role-sel" data-role="${m.id}" aria-label="Role">${G.ROLES.filter((r) => isOwner || r !== 'owner').map((r) => `<option value="${r}"${r === m.role ? ' selected' : ''}>${r}</option>`).join('')}</select>` : `<span class="badge info">${esc(m.role)}</span>`;
      host.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Members</h3><p class="muted small">People who can sign in to this company. Personnel (operators) is a separate catalog.</p></div><button class="btn primary sm" data-invite>${UI.icon('plus', 14)} Invite user</button></div>
        ${UI.table([{ label: 'First name', render: (m) => `<b>${esc(m.first_name || m.name || m.email.split('@')[0])}</b>` }, { label: 'Last name', render: (m) => esc(m.last_name || '—') }, { label: 'Email', render: (m) => `<span class="muted">${esc(m.email)}</span>` }, { label: 'Role', render: roleSel },
          { label: 'Status', render: (m) => `<span class="badge ${m.status === 'active' ? 'run' : 'idle'}">${m.status === 'active' ? 'Active' : 'Disabled'}</span>` },
          { label: 'Since', render: (m) => esc(fmtD(m.created_at)) },
          { label: '', align: 'right', render: (m) => (canTouch(m) ? `<button class="btn sm ${m.status === 'active' ? '' : 'primary'}" data-toggle="${m.id}">${m.status === 'active' ? 'Disable' : 'Enable'}</button>` : `<span class="muted small">${m.email.toLowerCase() === me ? 'You' : ''}</span>`) }], mem, { empty: 'No users yet.' })}</div>
        <div class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>Pending invitations</h3><p class="muted small">Each link works once and expires in ${DAYS} days.</p></div></div>
        ${UI.table([{ label: 'First name', key: 'first_name' }, { label: 'Last name', key: 'last_name' }, { label: 'Email', key: 'email' }, { label: 'Role', render: (i) => `<span class="badge info">${esc(i.role)}</span>` }, { label: 'Expires', render: (i) => esc(fmtD(i.expires_at)) },
          { label: '', align: 'right', render: (i) => `<button class="btn sm" data-resend="${i.id}">Resend (new link)</button> <button class="btn sm danger" data-revoke="${i.id}">Revoke</button>` }], pend, { empty: 'No pending invitations.' })}
        ${past.length ? `<p class="muted small" style="margin-top:10px">${past.filter((i) => i.status === 'accepted').length} accepted · ${past.filter((i) => i.status === 'revoked').length} revoked · ${past.filter((i) => i.status === 'pending').length} expired</p>` : ''}</div>`;
      host.onclick = async (e) => {
        if (e.target.closest('[data-invite]')) return openInvite();
        const t = e.target.closest('[data-toggle]'), rs = e.target.closest('[data-resend]'), rv = e.target.closest('[data-revoke]');
        try {
          if (t) { const m = mem.find((x) => x.id === t.dataset.toggle); if (m.status === 'active' && !(await UI.confirm({ title: `Disable ${m.email}?`, message: 'They will lose access to this company immediately.', confirmLabel: 'Disable', danger: true }))) return; await api.status(m.id, m.status === 'active' ? 'disabled' : 'active'); UI.toast(m.status === 'active' ? 'User disabled' : 'User enabled'); draw(); }
          else if (rs) { const i = inv.find((x) => x.id === rs.dataset.resend), r = await Inv.make(G.db.companyId, i.email, i.role, me, i); G.afterInvite(r); draw(); }
          else if (rv) { await api.revoke(rv.dataset.revoke); UI.toast('Invitation revoked'); draw(); }
        } catch (er) { UI.toast(UI.errMsg(er), 'err'); }
      };
      host.onchange = async (e) => { const s = e.target.closest('[data-role]'); if (!s) return; try { await api.role(s.dataset.role, s.value); UI.toast('Role updated'); draw(); } catch (er) { UI.toast(UI.errMsg(er), 'err'); draw(); } };
    } catch (e) { console.error(e); UI.error(host, e, draw); }
  }
  function openInvite() {
    const isOwner = G.user.role === 'owner', roles = G.ROLES.filter((r) => isOwner || r !== 'owner');
    const m = UI.modal({ title: 'Invite user', subtitle: G.db.company().name, size: 'md', body: `<div class="two-col"><div class="field"><label for="in-first">First name</label><input id="in-first" autocomplete="off"></div><div class="field"><label for="in-last">Last name</label><input id="in-last" autocomplete="off"></div></div>
      <div class="field"><label for="in-email">Email</label><input id="in-email" type="email" placeholder="person@company.com"></div>
      <div class="field"><label for="in-role">Role</label><select id="in-role">${roles.map((r) => `<option value="${r}"${r === 'supervisor' ? ' selected' : ''}>${r} — ${esc(G.t(ROLE_NOTE[r]))}</option>`).join('')}</select></div><div class="form-error" id="in-err" hidden></div>`, footer: '<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-send>Create invitation</button>' });
    $('[data-send]', m.root).onclick = async () => {
      const err = $('#in-err', m.root); try { const r = await Inv.make(G.db.companyId, $('#in-email', m.root).value, $('#in-role', m.root).value, G.user.email, { first_name: $('#in-first', m.root).value, last_name: $('#in-last', m.root).value }); m.close(); G.afterInvite(r); draw(); } catch (ex) { err.hidden = false; err.textContent = G.t(ex.message); }
    };
    setTimeout(() => $('#in-first', m.root) && $('#in-first', m.root).focus(), 60);
  }
  /** Muestra el enlace UNA vez (en la base solo queda el hash) y simula el correo */
  function showLink(r, email, coName) {
    const co = coName || G.db.company().name, m =UI.modal({ title: 'Invitation ready', subtitle: email, size: 'md', body: `<p class="muted">${G.L('En producción este enlace se envía por correo. Cópialo ahora: por seguridad no se vuelve a mostrar (si se pierde, usa "Resend").', 'In production this link is emailed to the person. Copy it now: for security it is not shown again (use “Resend” if it is lost).')}</p>
      <div class="invite-link"><input readonly value="${esc(r.link)}" id="il-v" aria-label="Invitation link"><button class="btn primary sm" id="il-copy">${UI.icon('copy', 14)} Copy</button></div>
      <div class="invite-mail"><b>${esc(G.L(`Te invitaron a ${co} en GUVEL Operational System`, `You have been invited to ${co} on GUVEL Operational System`))}</b><p>${esc(G.L(`Rol: ${r.invite.role}. El enlace caduca en ${DAYS} días y solo se puede usar una vez.`, `Role: ${r.invite.role}. The link expires in ${DAYS} days and can be used once.`))}</p><span class="btn sm primary" style="pointer-events:none">${G.L('Aceptar invitación', 'Accept invitation')}</span></div>`, footer: '<button class="btn primary" data-close>Done</button>' });
    $('#il-copy', m.root).onclick = async () => { const v = $('#il-v', m.root); try { await navigator.clipboard.writeText(v.value); UI.toast('Link copied'); } catch (e) { v.select(); document.execCommand && document.execCommand('copy'); UI.toast('Link selected — press Ctrl+C'); } };
  }
  G.showInviteLink = showLink;

  G.Pages.users = { async render(host) { st.host = host; await draw(); }, refresh() { return draw(); }, destroy() { st.token++; st.host = null; } };
})();
