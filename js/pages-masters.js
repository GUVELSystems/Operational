/* pages-masters.js — Customers, Machines, Personnel, Settings (Shifts + Preferences) con un generador CRUD compartido */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;

  /* ---------- Campo de formulario ---------- */
  function fieldHTML(f, v) {
    const id = 'f-' + f.name, val = v == null ? '' : v;
    const ctl = f.options
      ? `<select id="${id}" name="${f.name}">${UI.opts(f.options, val, { blank: f.blank })}</select>`
      : `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" ${f.attrs || ''} placeholder="${esc(f.placeholder || '')}" autocomplete="off">`;
    return `<div class="field${f.span2 ? ' span-2' : ''}"><label for="${id}">${esc(f.label)}${f.req ? '<span class="req"> *</span>' : ''}</label>${ctl}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
  }

  /* ---------- Formulario modal (alta / edición) ---------- */
  function openForm(cfg, row, onSaved) {
    const fid = 'crud-form-' + Math.random().toString(36).slice(2, 7);
    const modal = UI.modal({
      title: (row ? 'Edit ' : 'Add ') + cfg.noun, size: 'md',
      body: `<form id="${fid}" novalidate><div class="form-grid">${cfg.fields.map((f) => fieldHTML(f, row ? (cfg.getValue ? cfg.getValue(row, f.name) : row[f.name]) : f.default)).join('')}</div>${cfg.formExtra || ''}<div class="form-error" hidden role="alert"></div></form>`,
      footer: `<button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit" form="${fid}">${row ? 'Save changes' : cfg.addLabel}</button>`
    });
    const form = $('#' + fid, modal.body), errEl = $('.form-error', form);
    if (cfg.afterOpen) cfg.afterOpen(form);
    form.onsubmit = async (e) => {
      e.preventDefault(); errEl.hidden = true;
      const vals = {}; cfg.fields.forEach((f) => { vals[f.name] = String(form.elements[f.name].value).trim(); });
      const missing = cfg.fields.find((f) => f.req && !vals[f.name]);
      const msg = missing ? `Enter the ${missing.label.toLowerCase()}.` : cfg.validate ? cfg.validate(vals, row) : '';
      if (msg) { errEl.textContent = msg; errEl.hidden = false; return; }
      const btn = $('[type=submit]', modal.foot); btn.disabled = true;
      try {
        const payload = cfg.toRow(vals);
        if (row) await db.update(cfg.table, row.id, payload); else await db.insert(cfg.table, payload);
        G.Cache.invalidate(); UI.toast(row ? `${cfg.Noun} updated` : `${cfg.Noun} added`); modal.close(); if (onSaved) onSaved();
      } catch (err) { errEl.textContent = UI.errMsg(err); errEl.hidden = false; btn.disabled = false; }
    };
    return modal;
  }

  /* ---------- Página CRUD genérica ---------- */
  function crudPage(cfg) {
    const st = { host: null, q: '', tab: 'all', token: 0, m: null, ctx: null };
    cfg.Noun = cfg.noun.charAt(0).toUpperCase() + cfg.noun.slice(1);
    const canEdit = () => G.can(cfg.perm);
    async function draw() {
      const host = st.host; if (!host || !host.isConnected) return;
      const tk = ++st.token;
      try {
        const [m, ctx] = await Promise.all([G.Cache.master(), cfg.extra ? cfg.extra() : null]); if (tk !== st.token) return;
        st.m = m; st.ctx = ctx;
        const rows = cfg.rows(m);
        host.innerHTML = `<div class="crud-top"><div class="toolbar">
            <div class="search-input grow"><span aria-hidden="true">${UI.icon('search', 16)}</span><input type="search" class="crud-q" placeholder="Search ${esc(cfg.noun)}s…" aria-label="Search ${esc(cfg.noun)}s" value="${esc(st.q)}"></div>
            ${canEdit() ? `<button class="btn primary" data-add>${UI.icon('plus', 16)} ${esc(cfg.addLabel)}</button>` : ''}</div>
          ${cfg.tabs ? `<div class="tabs" role="tablist">${cfg.tabs.map((t) => `<button class="tab${st.tab === t.id ? ' active' : ''}" role="tab" data-tab="${t.id}">${esc(t.label)} <span class="count">${rows.filter(t.filter).length}</span></button>`).join('')}</div>` : ''}
          ${canEdit() ? '' : `<div class="notice">${UI.icon('alert', 16)}<span>${esc(cfg.viewOnly || `You have view-only access to ${cfg.noun}s.`)}</span></div>`}</div>
          ${cfg.intro ? `<div class="notice">${UI.icon('sparkles', 16)}<span>${cfg.intro}</span></div>` : ''}
          <div class="panel crud-list"></div>`;
        const q = $('.crud-q', host); q.oninput = U.debounce(() => { st.q = q.value; drawList(); }, 150);
        const add = $('[data-add]', host); if (add) add.onclick = () => openForm(cfg, null, draw);
        U.$$('[data-tab]', host).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; draw(); }));
        drawList();
      } catch (e) { console.error(e); UI.error(host, e, draw); }
    }
    function drawList() {
      const host = $('.crud-list', st.host); if (!host) return;
      const tab = cfg.tabs && cfg.tabs.find((t) => t.id === st.tab), nq = U.norm(st.q);
      const rows = cfg.rows(st.m).filter((r) => (!tab || tab.filter(r)) && (!nq || U.norm(cfg.search(r, st.m)).includes(nq)));
      const cols = cfg.columns(st.m, st.ctx).slice();
      if (canEdit()) cols.push({ label: 'Actions', cls: 'actions', render: (r) => `<button class="icon-btn" data-act="edit" data-id="${esc(r.id)}" aria-label="Edit ${esc(cfg.label(r))}">${UI.icon('edit', 16)}</button><button class="icon-btn" data-act="del" data-id="${esc(r.id)}" aria-label="Delete ${esc(cfg.label(r))}">${UI.icon('trash', 16)}</button>` });
      host.innerHTML = UI.table(cols, rows, { empty: nq ? `No ${cfg.noun}s match “${st.q}”.` : cfg.empty, rowAttrs: (r) => `data-id="${esc(r.id)}"${cfg.profile ? ' class="clickable"' : ''}` });
      host.onclick = (e) => {
        const b = e.target.closest('[data-act]'), id = (b || e.target.closest('tr[data-id]') || {}).dataset && (b || e.target.closest('tr[data-id]')).dataset.id;
        const row = id && st.m && cfg.rows(st.m).find((r) => r.id === id); if (!row) return;
        if (b && b.dataset.act === 'edit') openForm(cfg, row, draw);
        else if (b && b.dataset.act === 'del') remove(row);
        else if (!b && cfg.profile) cfg.profile(row, st.m, draw);
      };
    }
    async function remove(row) {
      if (!(await UI.confirm({ title: `Delete ${cfg.noun}?`, message: `<b>${esc(cfg.label(row))}</b> will be removed. This cannot be undone.`, confirmLabel: `Delete ${cfg.noun}`, danger: true }))) return;
      try { await db.delete(cfg.table, row.id); G.Cache.invalidate(); UI.toast(`${cfg.Noun} deleted`); draw(); } catch (e) { UI.toast(UI.errMsg(e), 'err'); }
    }
    return { render(host) { st.host = host; st.q = ''; st.tab = 'all'; return draw(); }, refresh() { G.Cache.invalidate(); return draw(); }, destroy() { st.token++; st.host = null; } };
  }

  /* ---------- Customers ---------- */
  const customers = crudPage({
    table: 'customers', noun: 'customer', addLabel: 'Add customer', perm: 'masters', empty: 'No customers yet — add the first company you build parts for.',
    fields: [{ name: 'code', label: 'Customer code', req: true, placeholder: 'e.g. ACM', hint: 'Short and unique. Saved in capitals.', attrs: 'maxlength="12"' }, { name: 'name', label: 'Customer name', req: true, placeholder: 'e.g. Acme Automotive' }],
    toRow: (v) => ({ code: v.code.toUpperCase(), name: v.name }), label: (r) => `${r.code} — ${r.name}`, search: (r) => `${r.code} ${r.name}`,
    rows: (m) => m.customers,
    columns: (m) => [{ label: 'Code', render: (r) => `<b>${esc(r.code)}</b>` }, { label: 'Name', key: 'name' }, { label: 'Part numbers', align: 'right', render: (r) => U.fmtNum(m.part_numbers.filter((p) => p.customer_id === r.id).length) }]
  });

  /* ---------- Machines ---------- */
  const machinesCfg = {
    table: 'machines', noun: 'machine', addLabel: 'Add machine', perm: 'masters', empty: 'No machines yet — add the first one to start tracking production.',
    fields: [{ name: 'code', label: 'Machine code', req: true, placeholder: 'e.g. PRS-05', hint: 'Family prefix + number (PRS, CNC, INJ…). Must be unique.', attrs: 'maxlength="12"' }, { name: 'name', label: 'Machine name', req: true, placeholder: 'e.g. Press 200T C' }, { name: 'brand', label: 'Brand', placeholder: 'e.g. Schuler', span2: true }],
    validate: (v) => (/^[A-Za-z]{2,6}-\d{1,3}$/.test(v.code) ? '' : 'Use a family prefix, a dash and a number — for example PRS-05.'),
    toRow: (v) => ({ code: v.code.toUpperCase(), name: v.name, brand: v.brand || null }), label: (r) => `${r.code} — ${r.name}`, search: (r) => `${r.code} ${r.name} ${r.brand || ''}`,
    rows: (m) => m.machines.slice().sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    extra: async () => new Set((await db.select('machine_production_sessions', { where: { status: 'RUNNING' } })).map((s) => s.machine_id)),
    columns: (m, running) => [{ label: 'Code', render: (r) => `<b>${esc(r.code)}</b>` }, { label: 'Name', key: 'name' }, { label: 'Brand', key: 'brand' }, { label: 'Part numbers', align: 'right', render: (r) => U.fmtNum(m.links.filter((l) => l.machine_id === r.id).length) }, { label: 'Status', render: (r) => UI.badge(running && running.has(r.id) ? 'RUNNING' : 'IDLE', running && running.has(r.id) ? 'run' : 'idle') }],
    profile(r, m, reload) {
      const parts = m.links.filter((l) => l.machine_id === r.id).map((l) => m.byId.part_numbers[l.part_number_id]).filter(Boolean);
      const modal = UI.modal({ title: `${r.code} — ${r.name}`, subtitle: r.brand ? `Brand: ${r.brand}` : 'No brand set', size: 'md', body: '<div class="state state-loading"><span class="spinner"></span></div>' });
      db.select('machine_production_sessions', { where: { machine_id: r.id, status: 'RUNNING' }, embed: ['part_numbers', 'shifts'] }).then((ss) => {
        const s = ss[0];
        modal.setBody(`<div class="profile-block"><div class="profile-head"><span class="badge ${s ? 'run' : 'idle'}">${s ? 'RUNNING' : 'IDLE'}</span>${s ? `<span class="muted">${esc(s.part_numbers.part_number)} · Lot ${esc(s.lot_number)} · ${esc(s.shifts.code)}</span>` : '<span class="muted">No active session</span>'}</div>
          <h3 class="sec-title">Linked part numbers</h3>${parts.length ? `<div class="chip-row">${parts.map((p) => `<span class="chip">${esc(p.part_number)}</span>`).join('')}</div>` : '<p class="muted">No part numbers linked yet. Link them from the part number profile.</p>'}</div>`);
        modal.setFooter(`${G.can('masters') ? '<button class="btn" data-edit>Edit machine</button>' : ''}<button class="btn primary" data-open>Open in Production</button>`);
        const ed = $('[data-edit]', modal.foot); if (ed) ed.onclick = () => { modal.close(); openForm(machinesCfg, r, reload); };
        $('[data-open]', modal.foot).onclick = () => { modal.close(); G.Router.go('production/' + r.id); };
      }).catch((e) => UI.error(modal.body, e));
    }
  };
  const machines = crudPage(machinesCfg);

  /* ---------- Personnel ---------- */
  const personnel = crudPage({
    table: 'personnel', noun: 'person', addLabel: 'Add person', perm: 'personnel', empty: 'No people yet — add operators and supervisors to assign them to sessions.',
    intro: 'Active people appear in the Operator and Supervisor lists when you start production.',
    fields: [{ name: 'employee_id', label: 'Employee ID', req: true, placeholder: 'e.g. E-1005' }, { name: 'role', label: 'Role', req: true, options: [{ value: 'Operator', label: 'Operator' }, { value: 'Supervisor', label: 'Supervisor' }], default: 'Operator' },
      { name: 'first_name', label: 'First name', req: true }, { name: 'last_name', label: 'Last name', req: true }, { name: 'is_active', label: 'Status', req: true, options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }], default: 'true' }],
    getValue: (r, n) => (n === 'is_active' ? String(!!r.is_active) : r[n]),
    toRow: (v) => ({ employee_id: v.employee_id, first_name: v.first_name, last_name: v.last_name, role: v.role, is_active: v.is_active === 'true' }),
    label: (r) => `${r.first_name} ${r.last_name}`, search: (r) => `${r.employee_id} ${r.first_name} ${r.last_name} ${r.role}`,
    rows: (m) => m.personnel.slice().sort((a, b) => a.last_name.localeCompare(b.last_name)),
    tabs: [{ id: 'all', label: 'All', filter: () => true }, { id: 'active', label: 'Active', filter: (r) => r.is_active }, { id: 'inactive', label: 'Inactive', filter: (r) => !r.is_active }],
    columns: () => [{ label: 'Name', render: (r) => `<span class="person-cell">${UI.avatar(r.first_name + ' ' + r.last_name, r.employee_id.charCodeAt(r.employee_id.length - 1))}<b>${esc(r.first_name)} ${esc(r.last_name)}</b></span>` }, { label: 'Employee ID', key: 'employee_id' }, { label: 'Role', render: (r) => UI.badge(r.role, r.role === 'Supervisor' ? 'info' : 'neutral') }, { label: 'Status', render: (r) => UI.badge(r.is_active ? 'Active' : 'Inactive', r.is_active ? 'ok' : 'bad') }]
  });

  /* ---------- Settings → Shifts ---------- */
  const mins = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0); };
  G.shiftPreview = (start, end, excl) => { if (!start || !end) return null; const s = mins(start), e = mins(end); if (s === e) return null; const dur = e <= s ? e + 1440 - s : e - s, ex = Number(excl) || 0; return { duration: dur, planned: dur - ex, overnight: e < s }; };
  const fmtH = (m) => `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
  const shifts = crudPage({
    table: 'shifts', noun: 'shift', addLabel: 'Add shift', perm: 'settings', empty: 'No shifts yet — add one so Real Time hours and OEE know the plant schedule.',
    viewOnly: 'You have view-only access to Settings. Ask an admin to change shifts.',
    intro: 'Shift schedules drive the <b>Real Time hours</b> in Production and the <b>planned time</b> used for OEE. Night shifts can end after midnight (e.g. 22:00 → 06:00).',
    fields: [{ name: 'code', label: 'Shift code', req: true, placeholder: 'e.g. T1' }, { name: 'name', label: 'Shift name', req: true, placeholder: 'e.g. Shift 1 (Day)' }, { name: 'start_time', label: 'Start time', req: true, type: 'time' }, { name: 'end_time', label: 'End time', req: true, type: 'time' },
      { name: 'excluded_planned_minutes', label: 'Excluded planned minutes (breaks)', req: true, type: 'number', attrs: 'min="0" step="1" inputmode="numeric"', default: '30', span2: true, hint: 'Breaks and meals removed from planned production time.' }],
    getValue: (r, n) => (n === 'start_time' || n === 'end_time' ? U.hm(r[n]) : r[n]),
    formExtra: '<div class="notice shift-preview" aria-live="polite">Pick a start and end time to preview the shift length.</div>',
    afterOpen(form) { const upd = () => { const p = G.shiftPreview(form.elements.start_time.value, form.elements.end_time.value, form.elements.excluded_planned_minutes.value), box = $('.shift-preview', form); box.innerHTML = p ? `Shift length <b>${fmtH(p.duration)}</b>${p.overnight ? ' (crosses midnight)' : ''} · planned time <b>${fmtH(Math.max(0, p.planned))}</b>` : 'Pick a start and end time to preview the shift length.'; }; form.addEventListener('input', upd); upd(); },
    validate(v) { if (!/^\d+$/.test(v.excluded_planned_minutes)) return 'Excluded minutes must be a whole number, 0 or more.'; if (mins(v.start_time) === mins(v.end_time)) return 'Start and end time must be different.'; const p = G.shiftPreview(v.start_time, v.end_time, v.excluded_planned_minutes); return p.planned <= 0 ? 'Excluded minutes must be shorter than the shift.' : ''; },
    toRow: (v) => ({ code: v.code.toUpperCase(), name: v.name, start_time: v.start_time + ':00', end_time: v.end_time + ':00', excluded_planned_minutes: Number(v.excluded_planned_minutes) }),
    label: (r) => `${r.code} — ${r.name}`, search: (r) => `${r.code} ${r.name}`, rows: (m) => m.shifts,
    columns: () => [{ label: 'Code', render: (r) => `<b>${esc(r.code)}</b>` }, { label: 'Name', key: 'name' }, { label: 'Window', render: (r) => esc(G.Shift.windowLabel(r)) }, { label: 'Length', align: 'right', render: (r) => fmtH(G.Shift.durationMin(r)) }, { label: 'Excluded', align: 'right', render: (r) => `${r.excluded_planned_minutes} min` }, { label: 'Planned', align: 'right', render: (r) => fmtH(G.Shift.plannedMin(r)) }]
  });

  /* ---------- Registro de páginas ---------- */
  G.Pages.customers = customers;
  G.Pages.machines = machines;
  G.Pages.personnel = personnel;
  G.Pages.settings = {
    tab: 'shifts',
    async render(host) {
      host.innerHTML = `<div class="tabs" role="tablist" style="margin-bottom:16px"><button class="tab" role="tab" data-t="shifts">Shifts</button><button class="tab" role="tab" data-t="prefs">Preferences</button></div><div class="settings-body"></div>`;
      const body = $('.settings-body', host), show = async (t) => {
        this.tab = t; U.$$('[data-t]', host).forEach((b) => b.classList.toggle('active', b.dataset.t === t));
        if (t === 'shifts') await shifts.render(body); else { shifts.destroy(); G.renderPrefs(body); }
      };
      U.$$('[data-t]', host).forEach((b) => (b.onclick = () => show(b.dataset.t)));
      await show(this.tab);
    },
    refresh() { return G.Router.reload(); },
    destroy() { shifts.destroy(); }
  };
})();
