/* pages-registers.js — Registers: Production / Scrap / Downtime (solo lectura + borrado) */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;
  const PAGE = 200;
  const blank = () => ({ from: '', to: '', customer: '', part: '', shift: '', q: '', limit: PAGE });
  const st = { host: null, tab: 'prod', f: { prod: blank(), scrap: blank(), down: blank() }, data: null, token: 0, off: null };

  /** Filtro puro: rows con {date:'YYYY-MM-DD', customerId, partId, shiftId, search}; f = {from,to,customer,part,shift,q} */
  G.registerFilters = (rows, f) => {
    const q = U.norm(f.q || '');
    return rows.filter((r) => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.customer || r.customerId === f.customer) && (!f.part || r.partId === f.part) && (!f.shift || r.shiftId === f.shift) && (!q || U.norm(r.search).includes(q)));
  };
  const person = (c) => c || '—';
  /** Resuelve contexto de una captura: usa el embed y, si falta, los maestros (Machine y Operation nunca quedan en "—" si existen) */
  G.registerContext = (cap, m) => {
    const part = cap.part_numbers || m.byId.part_numbers[cap.part_number_id] || null;
    const customer = cap.customers || m.byId.customers[cap.customer_id] || (part && m.byId.customers[part.customer_id]) || null;
    const shift = cap.shifts || m.byId.shifts[cap.shift_id] || null, machine = cap.machines || m.byId.machines[cap.machine_id] || null, op = cap.operations || m.byId.operations[cap.operation_id] || null;
    return { part, customer, shift, machine, op };
  };
  const ctxRow = (cap, m) => {
    const x = G.registerContext(cap, m);
    return { date: cap.production_date, customerId: cap.customer_id, partId: cap.part_number_id, shiftId: cap.shift_id, x, lot: cap.lot_number || '—', cap,
      customer: x.customer ? x.customer.name : '—', part: x.part ? x.part.part_number : '—', shift: x.shift ? x.shift.code : '—', machine: x.machine ? x.machine.code : '—', operation: x.op ? `${x.op.operation_number} · ${x.op.operation_name}` : '—' };
  };

  async function load() {
    const [m, caps, se, de] = await Promise.all([G.Cache.master(),
      db.select('production_captures', { embed: ['shifts', 'customers', 'part_numbers', 'machines', 'operations'], order: [['production_date', 'desc'], ['captured_at', 'desc']] }),
      db.select('scrap_events', { embed: ['scrap_catalog', 'production_captures'] }), db.select('downtime_events', { embed: ['downtime_catalog', 'production_captures'] })]);
    const capBy = Object.fromEntries(caps.map((c) => [c.id, c]));
    const prod = caps.map((c) => { const r = ctxRow(c, m); r.operator = person(c.operator_name); r.supervisor = person(c.supervisor_name); r.qty = c.production_quantity; r.search = `${c.lot_number} ${r.part} ${r.machine} ${r.customer} ${r.operation}`; r.id = c.id; return r; });
    const scrap = se.map((e) => { const cap = capBy[e.production_capture_id] || e.production_captures; if (!cap) return null; const r = ctxRow(cap, m), sc = e.scrap_catalog || {}; r.id = e.id; r.code = sc.code || '—'; r.defect = sc.defect || '—'; r.category = sc.category || '—'; r.qty = e.quantity; r.cost = e.quantity * (r.x.part ? Number(r.x.part.scrap_cost) || 0 : 0); r.reason = e.reason || '—'; r.search = `${cap.lot_number} ${r.part} ${r.machine} ${r.code} ${r.defect}`; return r; }).filter(Boolean);
    const down = de.map((e) => { const cap = capBy[e.production_capture_id] || e.production_captures; if (!cap) return null; const r = ctxRow(cap, m), dc = e.downtime_catalog || {}; r.id = e.id; r.code = dc.code || '—'; r.reasonName = dc.downtime || '—'; r.category = dc.category || '—'; r.type = e.event_type; r.minutes = e.minutes; r.note = e.reason || '—'; r.search = `${cap.lot_number} ${r.part} ${r.machine} ${r.code} ${r.reasonName}`; return r; }).filter(Boolean);
    return { m, prod, scrap, down, evCount: (id) => ({ s: se.filter((e) => e.production_capture_id === id).length, d: de.filter((e) => e.production_capture_id === id).length }) };
  }

  const COLS = {
    prod: [
      { label: 'Date / Time', render: (r) => `${esc(U.fmtDate(r.date))} <span class="muted small">${esc(U.fmtTime(r.cap.captured_at))}</span>` }, { label: 'Shift', key: 'shift' }, { label: 'Lot', key: 'lot' }, { label: 'Customer', key: 'customer' },
      { label: 'Part Number', render: (r) => `<b>${esc(r.part)}</b>` }, { label: 'Operation', key: 'operation' }, { label: 'Machine', render: (r) => `<b>${esc(r.machine)}</b>` }, { label: 'Operator', key: 'operator' }, { label: 'Supervisor', key: 'supervisor' },
      { label: 'Quantity', align: 'right', render: (r) => U.fmtNum(r.qty) }, { label: 'Confirmed', render: (r) => UI.badge(r.cap.confirmed ? 'Yes' : 'No', r.cap.confirmed ? 'ok' : 'idle') }
    ],
    scrap: [
      { label: 'Date', render: (r) => esc(U.fmtDate(r.date)) }, { label: 'Shift', key: 'shift' }, { label: 'Lot', key: 'lot' }, { label: 'Customer', key: 'customer' }, { label: 'Part Number', key: 'part' }, { label: 'Operation', key: 'operation' }, { label: 'Machine', key: 'machine' },
      { label: 'Code', render: (r) => `<b>${esc(r.code)}</b>` }, { label: 'Defect', key: 'defect' }, { label: 'Category', render: (r) => UI.badge(r.category, 'info') }, { label: 'Quantity', align: 'right', render: (r) => U.fmtNum(r.qty) },
      { label: 'Cost', align: 'right', render: (r) => U.money(r.cost) }, { label: 'Reason', key: 'reason' }
    ],
    down: [
      { label: 'Date', render: (r) => esc(U.fmtDate(r.date)) }, { label: 'Customer', key: 'customer' }, { label: 'Part Number', key: 'part' }, { label: 'Machine', key: 'machine' }, { label: 'Code', render: (r) => `<b>${esc(r.code)}</b>` }, { label: 'Reason', key: 'reasonName' },
      { label: 'Category', render: (r) => UI.badge(r.category, 'info') }, { label: 'Type', render: (r) => UI.badge(r.type, r.type === 'Planned' ? 'info' : 'watch') }, { label: 'Minutes', align: 'right', render: (r) => U.fmtNum(r.minutes) }, { label: 'Note', key: 'note' }
    ]
  };
  const CSV = {
    prod: [['Date', (r) => r.date], ['Time', (r) => U.fmtTime(r.cap.captured_at)], ['Shift', (r) => r.shift], ['Lot', (r) => r.lot], ['Customer', (r) => r.customer], ['Part Number', (r) => r.part], ['Operation', (r) => r.operation], ['Machine', (r) => r.machine], ['Operator', (r) => r.operator], ['Supervisor', (r) => r.supervisor], ['Quantity', (r) => r.qty], ['Confirmed', (r) => (r.cap.confirmed ? 'Yes' : 'No')]],
    scrap: [['Date', (r) => r.date], ['Shift', (r) => r.shift], ['Lot', (r) => r.lot], ['Customer', (r) => r.customer], ['Part Number', (r) => r.part], ['Operation', (r) => r.operation], ['Machine', (r) => r.machine], ['Code', (r) => r.code], ['Defect', (r) => r.defect], ['Category', (r) => r.category], ['Quantity', (r) => r.qty], ['Cost', (r) => r.cost.toFixed(2)], ['Reason', (r) => r.reason]],
    down: [['Date', (r) => r.date], ['Customer', (r) => r.customer], ['Part Number', (r) => r.part], ['Machine', (r) => r.machine], ['Code', (r) => r.code], ['Reason', (r) => r.reasonName], ['Category', (r) => r.category], ['Type', (r) => r.type], ['Minutes', (r) => r.minutes], ['Note', (r) => r.note]]
  };
  const NAMES = { prod: 'production', scrap: 'scrap', down: 'downtime' };

  function cards(tab, rows) {
    const c = [];
    if (tab === 'prod') c.push(['Captures', U.fmtNum(rows.length)], ['Pieces produced', U.fmtNum(U.sum(rows, (r) => r.qty))], ['Confirmed', U.fmtNum(rows.filter((r) => r.cap.confirmed).length)]);
    else if (tab === 'scrap') c.push(['Scrap records', U.fmtNum(rows.length)], ['Scrap quantity', U.fmtNum(U.sum(rows, (r) => r.qty))], ['Scrap cost', U.money(U.sum(rows, (r) => r.cost))]);
    else c.push(['Downtime records', U.fmtNum(rows.length)], ['Total minutes', U.fmtNum(U.sum(rows, (r) => r.minutes))], ['Unplanned minutes', U.fmtNum(U.sum(rows.filter((r) => r.type === 'Unplanned'), (r) => r.minutes))]);
    return `<div class="grid cols-3 reg-cards">${c.map(([k, v]) => `<div class="kpi-card"><div class="kpi-label">${esc(k)}</div><div class="kpi-value">${esc(v)}</div></div>`).join('')}</div>`;
  }

  async function draw(reload = true) {
    const host = st.host; if (!host || !host.isConnected) return;
    const tk = ++st.token;
    try {
      if (reload || !st.data) { UI.loading(host, 'Loading registers…'); st.data = await load(); }
      if (tk !== st.token) return;
      const d = st.data, m = d.m, f = st.f[st.tab], canDel = G.can('deleteRegisters'), canExp = G.can('export');
      const all = d[st.tab], rows = G.registerFilters(all, f), shown = rows.slice(0, f.limit);
      const filtersActive = f.from || f.to || f.customer || f.part || f.shift || f.q;
      host.innerHTML = `<div class="toolbar"><div class="tabs" role="tablist">${[['prod', 'Production'], ['scrap', 'Scrap'], ['down', 'Downtime']].map(([k, l]) => `<button class="tab ${st.tab === k ? 'active' : ''}" role="tab" data-tab="${k}">${l} <span class="count">${d[k].length}</span></button>`).join('')}</div>
          <span class="grow"></span><button class="btn" id="rg-refresh">${UI.icon('refresh', 16)} Refresh</button>${canExp ? `<button class="btn primary" id="rg-export">${UI.icon('download', 16)} Export Data</button>` : ''}</div>
        <div class="panel reg-filters"><div class="form-grid">
          <div class="field"><label>Date From</label><input type="date" data-f="from" value="${esc(f.from)}"></div><div class="field"><label>Date To</label><input type="date" data-f="to" value="${esc(f.to)}"></div>
          <div class="field"><label>Customer</label><select data-f="customer">${UI.opts(m.customers, f.customer, { blank: 'All customers', label: (c) => c.name, val: (c) => c.id })}</select></div>
          <div class="field"><label>Part Number</label><select data-f="part">${UI.opts(m.part_numbers, f.part, { blank: 'All part numbers', label: (p) => p.part_number, val: (p) => p.id })}</select></div>
          <div class="field"><label>Shift</label><select data-f="shift">${UI.opts(m.shifts, f.shift, { blank: 'All shifts', label: (s) => s.code, val: (s) => s.id })}</select></div>
          <div class="field"><label>Search</label><input type="search" data-f="q" placeholder="Lot, part, machine, defect…" value="${esc(f.q)}"></div></div>
          ${filtersActive ? '<div class="btn-row" style="margin-top:10px"><button class="btn sm ghost" id="rg-clear">Clear filters</button></div>' : ''}</div>
        ${cards(st.tab, rows)}
        <div class="panel" style="margin-top:16px">${UI.table(COLS[st.tab].concat([{ label: '', cls: 'actions', render: (r) => (canDel ? `<button class="btn sm danger" data-del="${esc(r.id)}" aria-label="${st.tab === 'prod' ? 'Delete capture' : 'Delete record'}">${UI.icon('trash', 14)} ${st.tab === 'prod' ? 'Delete Capture' : 'Delete'}</button>` : '') }]), shown, { empty: all.length ? 'No records match these filters.' : 'No records yet.', cls: 'reg-table' })}
          ${rows.length > shown.length ? `<div class="btn-row" style="justify-content:center;margin-top:12px"><span class="muted small">Showing ${shown.length} of ${rows.length}</span><button class="btn sm" id="rg-more">Show more</button></div>` : ''}</div>`;
      bind(host, rows);
    } catch (e) { console.error(e); UI.error(host, e, () => draw(true)); }
  }

  function bind(host, rows) {
    U.$$('[data-tab]', host).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; draw(false); }));
    const f = st.f[st.tab];
    U.$$('[data-f]', host).forEach((el) => { const k = el.dataset.f; const h = () => { f[k] = el.value; f.limit = PAGE; if (k === 'q') { clearTimeout(st.qt); st.qt = setTimeout(() => draw(false).then(() => { const n = $('[data-f=q]', st.host); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }), 250); } else draw(false); }; el.addEventListener(k === 'q' ? 'input' : 'change', h); });
    const clr = $('#rg-clear', host); if (clr) clr.onclick = () => { st.f[st.tab] = blank(); draw(false); };
    const more = $('#rg-more', host); if (more) more.onclick = () => { f.limit += PAGE; draw(false); };
    $('#rg-refresh', host).onclick = async () => { G.Cache.invalidate(); await draw(true); UI.toast('Registers refreshed'); };
    const ex = $('#rg-export', host);
    if (ex) ex.onclick = () => { if (!rows.length) { UI.toast('There is nothing to export with these filters.', 'err'); return; } U.download(`guvel-${NAMES[st.tab]}-${U.today()}.csv`, U.csv(rows, CSV[st.tab].map(([label, value]) => ({ label, value })))); UI.toast(`${U.fmtNum(rows.length)} rows exported`); };
    U.$$('[data-del]', host).forEach((b) => (b.onclick = () => del(b.dataset.del)));
  }

  async function del(id) {
    const tab = st.tab, r = st.data[tab].find((x) => x.id === id); if (!r) return;
    let msg;
    if (tab === 'prod') { const n = st.data.evCount(id); msg = `Delete the capture of <b>${esc(r.part)}</b> on <b>${esc(r.machine)}</b> (${esc(U.fmtDate(r.date))}, ${U.fmtNum(r.qty)} pieces)?<br><br>Its <b>${n.s} scrap</b> and <b>${n.d} downtime</b> records will be deleted with it. This cannot be undone.`; }
    else msg = `Delete this ${tab === 'scrap' ? `scrap record (${esc(r.code)} · ${U.fmtNum(r.qty)} pcs)` : `downtime record (${esc(r.code)} · ${U.fmtNum(r.minutes)} min)`} for <b>${esc(r.part)}</b> on <b>${esc(r.machine)}</b>? This cannot be undone.`;
    if (!(await UI.confirm({ title: tab === 'prod' ? 'Delete capture?' : 'Delete record?', message: msg, confirmLabel: 'Delete', danger: true }))) return;
    try { if (tab === 'prod') await db.deleteCapture(id); else await db.delete(tab === 'scrap' ? 'scrap_events' : 'downtime_events', id); UI.toast('Record deleted'); await draw(true); }
    catch (e) { UI.toast(UI.errMsg(e), 'err'); }
  }

  G.Pages.registers = {
    async render(host) { st.host = host; st.off && st.off(); await draw(true); },
    refresh() { G.Cache.invalidate(); return draw(true); },
    destroy() { st.token++; st.host = null; st.data = null; }
  };
})();
