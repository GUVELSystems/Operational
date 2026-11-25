/* pages-runs.js — Runs: perfil de trazabilidad por corrida (lote, cantidades, scrap, downtime).
   Una corrida = captura final de una sesión (o captura manual) + las sesiones RUNNING (con sus horas de Real Time). */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;
  const S = { host: null, runs: [], sel: null, q: '', limit: 80, tk: 0, m: null };
  const runId = (id) => 'PR-' + String(id).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
  const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : '—');

  async function load() {
    const [m, caps, se, de, sessions] = await Promise.all([G.Cache.master(), db.select('production_captures', { embed: ['shifts', 'machines', 'operations', 'part_numbers', 'customers'], order: [['captured_at', 'desc']] }), db.select('scrap_events', { embed: ['scrap_catalog'] }), db.select('downtime_events', { embed: ['downtime_catalog'] }), db.select('machine_production_sessions', { where: { status: 'RUNNING' }, embed: ['operator', 'supervisor'] })]);
    const sBy = {}, dBy = {}; se.forEach((e) => (sBy[e.production_capture_id] = sBy[e.production_capture_id] || []).push(e)); de.forEach((e) => (dBy[e.production_capture_id] = dBy[e.production_capture_id] || []).push(e));
    const runs = [], liveBy = {};
    caps.forEach((c) => {
      if (c.hour_slot) { (liveBy[c.session_id] = liveBy[c.session_id] || []).push(c); return; }
      runs.push({ key: c.id, id: runId(c.id), cap: c, caps: [c], status: 'COMPLETED', source: c.session_id ? 'session' : 'manual', at: c.captured_at, se: sBy[c.id] || [], de: dBy[c.id] || [] });
    });
    sessions.forEach((s) => {   // sesiones activas: se agregan sus horas ya capturadas
      const hs = (liveBy[s.id] || []).slice().sort((a, b) => (a.hour_slot < b.hour_slot ? -1 : 1)), base = hs[0] || {};
      const cap = { ...base, production_quantity: hs.reduce((a, h) => a + h.production_quantity, 0), lot_number: s.lot_number, machine_id: s.machine_id, part_number_id: s.part_number_id, customer_id: s.customer_id, operation_id: s.operation_id, shift_id: s.shift_id, operator_name: fullName(s.operator), supervisor_name: fullName(s.supervisor), captured_at: s.started_at, production_date: U.ymd(new Date(s.started_at)), machines: m.byId.machines[s.machine_id], part_numbers: m.byId.part_numbers[s.part_number_id], customers: m.byId.customers[s.customer_id], operations: m.byId.operations[s.operation_id], shifts: m.byId.shifts[s.shift_id] };
      runs.push({ key: s.id, id: runId(s.id), cap, caps: hs, status: 'RUNNING', source: 'real time', at: s.started_at, se: hs.flatMap((h) => sBy[h.id] || []), de: hs.flatMap((h) => dBy[h.id] || []), live: true });
    });
    runs.sort((a, b) => (a.at < b.at ? 1 : -1)); S.runs = runs; S.m = m;
  }
  const filtered = () => { const q = U.norm(S.q); return S.runs.filter((r) => !q || U.norm(`${r.id} ${r.cap.lot_number} ${r.cap.part_numbers ? r.cap.part_numbers.part_number : ''} ${r.cap.machines ? r.cap.machines.code : ''} ${r.cap.operator_name || ''} ${r.cap.supervisor_name || ''} ${r.cap.customers ? r.cap.customers.name : ''}`).includes(q)); };

  function profile(r) {
    const c = r.cap, pn = c.part_numbers || {}, qty = U.sum(r.caps, (x) => x.production_quantity), scrap = U.sum(r.se, (e) => e.quantity), down = U.sum(r.de, (e) => e.minutes);
    const good = Math.max(0, qty - scrap), ct = c.operation_id ? G.cycleTime(S.m, c.part_number_id, c.operation_id, c.machine_id) : null, copq = scrap * (Number(pn.scrap_cost) || 0);
    const tile = (l, v) => `<div class="rn-tile"><span>${l}</span><b>${v}</b></div>`, info = (l, v) => `<div class="rn-info"><span>${l}</span><b>${esc(v == null || v === '' ? '—' : v)}</b></div>`;
    const sh = c.shifts, ev = (list, name, sub, val) => (list.length ? list.map((e) => `<div class="rn-ev"><div><b>${esc(name(e))}</b><span class="muted small">${esc(sub(e))}</span></div><b>${val(e)}</b></div>`).join('') : null);
    return `<div class="rn-head"><div><span class="rn-eyebrow">PRODUCTION RUN</span><h2>${esc(r.id)}</h2><div class="rn-tags"><span class="badge ${r.status === 'RUNNING' ? 'info' : 'ok'}">${r.status}</span><span class="muted small">${esc(r.source)}</span></div></div>
        <div class="rn-lot"><button class="btn sm" data-print>${UI.icon('download', 14)} Imprimir</button><div><span class="rn-eyebrow">LOT</span><b>${esc(c.lot_number)}</b></div></div></div>
      <div class="rn-tiles">${tile('Production', U.fmtNum(qty))}${tile('Scrap', U.fmtNum(scrap))}${tile('Yield', qty ? U.pct(good / qty, 2) : '—')}${tile('PPM', qty ? U.fmtNum(scrap / qty * 1e6) : '—')}${tile('COPQ', 'USD ' + U.fmtNum(copq, 2))}${tile('Tiempo Muerto', U.fmtNum(down) + ' min')}</div>
      <div class="rn-infos">${info('CUSTOMER', c.customers && c.customers.name)}${info('PART NUMBER', pn.part_number)}${info('OPERATION', c.operations ? `${c.operations.operation_number} · ${c.operations.operation_name}` : '')}${info('MACHINE', c.machines && c.machines.code)}${info('CT IDEAL', ct ? U.fmtNum(ct, 1) + ' s' : '')}
        ${info('SHIFT', sh && sh.code)}${info('OPERATOR', c.operator_name)}${info('SUPERVISOR', c.supervisor_name)}${info('RECORDED', U.fmtDateTime(c.captured_at))}${info('COMPLETED', r.status === 'COMPLETED' ? U.fmtDateTime(c.captured_at) : 'In progress')}</div>
      <div class="rn-cols"><section class="rn-panel"><span class="rn-eyebrow">QUALITY</span><h3>Quality Events</h3>${ev(r.se, (e) => (e.scrap_catalog ? `${e.scrap_catalog.code} — ${e.scrap_catalog.defect}` : 'Defect'), (e) => e.reason || (e.scrap_catalog ? e.scrap_catalog.category : ''), (e) => `${U.fmtNum(e.quantity)} pcs`) || '<p class="muted rn-none">No quality events.</p>'}</section>
        <section class="rn-panel rn-down"><span class="rn-eyebrow">MAINTENANCE</span><h3>Downtime</h3>${ev(r.de, (e) => (e.downtime_catalog ? e.downtime_catalog.downtime : 'Downtime'), (e) => e.event_type + (e.reason ? ' · ' + e.reason : ''), (e) => `${U.fmtNum(e.minutes)} min`) || '<p class="muted rn-none">No downtime events.</p>'}</section></div>`;
  }

  function draw() {
    const host = S.host; if (!host || !host.isConnected) return;
    const list = filtered(), cur = S.runs.find((r) => r.key === S.sel) || list.find((r) => U.sum(r.caps, (x) => x.production_quantity) > 0) || list[0] || null; if (cur) S.sel = cur.key;
    host.innerHTML = `<div class="rn-layout"><aside class="panel rn-list"><span class="rn-eyebrow">TRACEABILITY</span><h2>Runs <span class="chip">${S.runs.length}</span></h2>
      <div class="search-input" style="margin:12px 0"><span aria-hidden="true">${UI.icon('search', 16)}</span><input type="search" id="rn-q" placeholder="Search lot, PN, machine, operator…" aria-label="Search runs" value="${esc(S.q)}"></div>
      <div class="rn-items" role="listbox" aria-label="Runs">${list.slice(0, S.limit).map((r) => `<button class="rn-item${r.key === S.sel ? ' active' : ''}" role="option" aria-selected="${r.key === S.sel}" data-k="${esc(r.key)}"><div><b>${esc(r.id)} · ${esc(r.cap.lot_number)}</b><span class="muted small">${esc([r.cap.part_numbers && r.cap.part_numbers.part_number, r.cap.machines && r.cap.machines.code, U.fmtDateTime(r.at)].filter(Boolean).join(' · '))}</span></div>${r.live ? '<span class="badge info">RUNNING</span>' : ''}${UI.icon('chevron', 16)}</button>`).join('') || '<div class="state state-empty"><span>No runs match your search.</span></div>'}${list.length > S.limit ? `<button class="btn sm" id="rn-more">Show more (${list.length - S.limit})</button>` : ''}</div></aside>
      <section class="panel rn-profile" id="rn-profile">${cur ? profile(cur) : '<div class="state state-empty"><span>Select a run to see its profile.</span></div>'}</section></div>`;
    const q = $('#rn-q', host); q.oninput = U.debounce(() => { S.q = q.value; S.limit = 80; S.sel = null; draw(); const n = $('#rn-q', host); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 180);
    U.$$('.rn-item', host).forEach((b) => (b.onclick = () => { S.sel = b.dataset.k; U.$$('.rn-item', host).forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-selected', on); }); $('#rn-profile', host).innerHTML = profile(S.runs.find((r) => r.key === S.sel)); bindPrint(); if (innerWidth < 960) $('#rn-profile', host).scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    const more = $('#rn-more', host); if (more) more.onclick = () => { S.limit += 120; draw(); };
    bindPrint();
  }
  function bindPrint() {
    const b = $('[data-print]', S.host); if (!b) return;
    b.onclick = () => { const w = window.open('', '_blank', 'width=900,height=700'); if (!w) { UI.toast('Allow pop-ups to print the run.', 'err'); return; } w.document.write(`<title>${esc(runId(S.sel))}</title><style>body{font:14px system-ui;margin:24px;color:#0F1B2D}.rn-tiles,.rn-infos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.rn-tile,.rn-info,.rn-ev{border:1px solid #ccd;border-radius:8px;padding:8px 10px;display:grid}.rn-tile span,.rn-info span,.rn-eyebrow{font-size:10px;letter-spacing:.1em;color:#667}.rn-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rn-ev{grid-template-columns:1fr auto;margin-top:6px}button{display:none}.rn-head{display:flex;justify-content:space-between}</style>${$('#rn-profile', S.host).innerHTML}`); w.document.close(); w.focus(); w.print(); };
  }

  G.Pages.runs = {
    async render(host, params) { S.host = host; UI.loading(host, 'Loading runs…'); await load(); if (params && params[0]) S.sel = params[0]; draw(); },
    refresh() { return load().then(draw); }, destroy() { S.host = null; }
  };
  G.bus.on('db:change', ({ table }) => { if (S.host && ['production_captures', 'machine_production_sessions'].includes(table)) load().then(draw).catch(() => {}); });
})();
