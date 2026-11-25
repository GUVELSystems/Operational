/* pages-parts.js — Part Numbers: lista, CRUD y perfil (pestañas Operations y Machines; Defects y Barcode en pages-parts-b.js) */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;
  const st = { host: null, q: '', token: 0 };
  const canEdit = () => G.can('masters');
  const P = (G.PartsUI = {});

  /* ---------- Code 39 (SVG sin librerías). Patrones 9 elementos: barra,espacio,… (1 = ancho, 3 anchos por carácter) ---------- */
  const C39 = { 0: '000110100', 1: '100100001', 2: '001100001', 3: '101100000', 4: '000110001', 5: '100110000', 6: '001110000', 7: '000100101', 8: '100100100', 9: '001100100', A: '100001001', B: '001001001', C: '101001000', D: '000011001', E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100', K: '100000011', L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110', U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000', Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100', $: '010101000', '/': '010100010', '+': '010001010', '%': '000101010' };
  G.CODE39 = C39;
  G.code39Svg = (text, o = {}) => {
    const t = String(text || '').toUpperCase(), narrow = o.narrow || 2, ratio = o.ratio || 3, h = o.height || 80, quiet = o.quiet || 12;
    if (!t || [...t].some((c) => !C39[c] || c === '*')) return null;
    let x = quiet, bars = '';
    ('*' + t + '*').split('').forEach((ch) => { const pat = C39[ch]; for (let i = 0; i < 9; i++) { const w = pat[i] === '1' ? narrow * ratio : narrow; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${h}"/>`; x += w; } x += narrow; });
    const W = x - narrow + quiet;
    return `<svg class="barcode-svg" viewBox="0 0 ${W} ${h + 22}" role="img" aria-label="Code 39 barcode ${esc(t)}" preserveAspectRatio="xMidYMid meet"><rect width="${W}" height="${h + 22}" fill="#fff"/><g fill="#000">${bars}</g><text x="${W / 2}" y="${h + 17}" text-anchor="middle" font-family="monospace" font-size="15" fill="#000">${esc(t)}</text></svg>`;
  };

  /* ---------- Lista ---------- */
  async function draw() {
    const host = st.host; if (!host || !host.isConnected) return;
    const tk = ++st.token;
    try {
      const m = await G.Cache.master(); if (tk !== st.token) return;
      host.innerHTML = `<div class="crud-top"><div class="toolbar"><div class="search-input grow"><span aria-hidden="true">${UI.icon('search', 16)}</span><input type="search" class="pq" placeholder="Search part numbers…" aria-label="Search part numbers" value="${esc(st.q)}"></div>${canEdit() ? `<button class="btn primary" data-add>${UI.icon('plus', 16)} New part number</button>` : ''}</div>${canEdit() ? '' : `<div class="notice">${UI.icon('alert', 16)}<span>You have view-only access to part numbers.</span></div>`}</div><div class="panel crud-list"></div>`;
      const q = $('.pq', host); q.oninput = U.debounce(() => { st.q = q.value; list(m); }, 150);
      const add = $('[data-add]', host); if (add) add.onclick = () => partForm(m, null);
      list(m); if (st.q) q.focus();
    } catch (e) { console.error(e); UI.error(host, e, draw); }
  }
  function list(m) {
    const box = $('.crud-list', st.host), nq = U.norm(st.q);
    const rows = m.part_numbers.filter((p) => !nq || U.norm(`${p.part_number} ${p.description} ${(m.byId.customers[p.customer_id] || {}).name}`).includes(nq));
    box.innerHTML = UI.table([
      { label: 'Part number', render: (p) => `<b>${esc(p.part_number)}</b>` }, { label: 'Description', key: 'description' },
      { label: 'Customer', render: (p) => esc((m.byId.customers[p.customer_id] || {}).name || '—') },
      { label: 'Piece cost', align: 'right', render: (p) => U.money(p.piece_cost) }, { label: 'Scrap cost', align: 'right', render: (p) => U.money(p.scrap_cost) },
      { label: 'Ops', align: 'right', render: (p) => m.operations.filter((o) => o.part_number_id === p.id).length },
      { label: 'Machines', align: 'right', render: (p) => m.links.filter((l) => l.part_number_id === p.id).length },
      { label: 'Actions', cls: 'actions', render: (p) => `<button class="icon-btn" data-prof="${p.id}" aria-label="Open profile">${UI.icon('parts', 16)}</button>${canEdit() ? `<button class="icon-btn" data-edit="${p.id}" aria-label="Edit">${UI.icon('edit', 16)}</button><button class="icon-btn" data-del="${p.id}" aria-label="Delete">${UI.icon('trash', 16)}</button>` : ''}` }
    ], rows, { empty: nq ? 'No part numbers match your search.' : 'No part numbers yet — add the first one.', rowAttrs: (p) => `class="clickable" data-row="${p.id}"` });
    box.onclick = async (e) => {
      const b = e.target.closest('button[data-prof],button[data-edit],button[data-del]'), tr = e.target.closest('[data-row]');
      if (b && b.dataset.edit) return partForm(m, m.byId.part_numbers[b.dataset.edit]);
      if (b && b.dataset.del) return delPart(m.byId.part_numbers[b.dataset.del]);
      const id = b ? b.dataset.prof : tr && tr.dataset.row; if (id) openProfile(id);
    };
  }
  async function delPart(p) {
    if (!(await UI.confirm({ title: `Delete ${p.part_number}?`, message: 'Its operations, cycle times, machine links and part-specific defects will be deleted too. This cannot be undone.', confirmLabel: 'Delete part number', danger: true }))) return;
    try { await db.delete('part_numbers', p.id); G.Cache.invalidate(); UI.toast('Part number deleted'); draw(); } catch (e) { UI.toast(UI.errMsg(e), 'err'); }
  }
  function partForm(m, row) {
    const modal = UI.modal({ title: row ? 'Edit part number' : 'New part number', size: 'md', body: `<form id="pf" novalidate><div class="form-grid">
      <div class="field span-2"><label for="pf-c">Customer<span class="req"> *</span></label><select id="pf-c" name="c">${UI.opts(m.customers, row && row.customer_id, { blank: 'Select customer…', label: (c) => `${c.code} — ${c.name}`, val: (c) => c.id })}</select></div>
      <div class="field"><label for="pf-n">Part number<span class="req"> *</span></label><input id="pf-n" name="n" value="${esc(row ? row.part_number : '')}" autocomplete="off"></div>
      <div class="field"><label for="pf-d">Description</label><input id="pf-d" name="d" value="${esc(row ? row.description : '')}" autocomplete="off"></div>
      <div class="field"><label for="pf-p">Piece cost ($)</label><input id="pf-p" name="p" type="number" min="0" step="0.01" value="${row ? row.piece_cost : ''}"></div>
      <div class="field"><label for="pf-s">Scrap cost ($)</label><input id="pf-s" name="s" type="number" min="0" step="0.01" value="${row ? row.scrap_cost : ''}"></div></div><div class="form-error" hidden role="alert"></div></form>`, footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit" form="pf">${row ? 'Save changes' : 'Add part number'}</button>` });
    const f = $('#pf', modal.body), err = $('.form-error', f);
    f.onsubmit = async (e) => {
      e.preventDefault(); err.hidden = true; const v = (n) => String(f.elements[n].value).trim();
      const msg = !v('c') ? 'Select a customer.' : !v('n') ? 'Enter the part number.' : (v('p') !== '' && !(Number(v('p')) >= 0)) || (v('s') !== '' && !(Number(v('s')) >= 0)) ? 'Costs must be numbers of 0 or more.' : '';
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      const payload = { customer_id: v('c'), part_number: v('n').toUpperCase(), description: v('d'), piece_cost: Number(v('p') || 0), scrap_cost: Number(v('s') || 0) };
      try { if (row) await db.update('part_numbers', row.id, payload); else await db.insert('part_numbers', payload); G.Cache.invalidate(); UI.toast(row ? 'Part number updated' : 'Part number added'); modal.close(); draw(); } catch (e2) { err.textContent = UI.errMsg(e2); err.hidden = false; }
    };
  }

  /* ---------- Perfil ---------- */
  async function openProfile(id, startTab) {
    let m = await G.Cache.master(), p = m.byId.part_numbers[id]; if (!p) return;
    let tab = startTab || 'ops';
    const modal = UI.modal({ title: p.part_number, subtitle: p.description || '', size: 'xl', body: '<div class="state state-loading"><span class="spinner"></span></div>', onClose: () => draw() });
    const ctx = { modal, get m() { return m; }, get p() { return p; }, canEdit, refresh: async () => { G.Cache.invalidate(); m = await G.Cache.master(); p = m.byId.part_numbers[id]; await paint(); } };
    async function paint() {
      const cust = m.byId.customers[p.customer_id] || {};
      const tabs = [['ops', 'Operations'], ['machines', 'Machines'], ['defects', 'Defects'], ['barcode', 'Barcode']];
      modal.setBody(`<div class="part-meta"><span class="chip">${esc(cust.name || '—')}</span><span class="chip">Piece ${U.money(p.piece_cost)}</span><span class="chip">Scrap ${U.money(p.scrap_cost)}</span></div>
        <div class="tabs" role="tablist" style="margin:12px 0">${tabs.map(([k, l]) => `<button class="tab${tab === k ? ' active' : ''}" role="tab" data-tab="${k}">${l}</button>`).join('')}</div><div class="part-tab"></div>`);
      U.$$('[data-tab]', modal.body).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; paint(); }));
      const host = $('.part-tab', modal.body);
      try { if (tab === 'ops') opsTab(host, ctx); else if (tab === 'machines') machinesTab(host, ctx); else if (tab === 'defects') await P.defectsTab(host, ctx); else P.barcodeTab(host, ctx); } catch (e) { console.error(e); UI.error(host, e, paint); }
    }
    await paint();
  }

  /* ---------- Operations (+ tiempos de ciclo por máquina) ---------- */
  function opsTab(host, c) {
    const { m, p } = c, ops = m.operations.filter((o) => o.part_number_id === p.id).sort((a, b) => a.operation_number - b.operation_number);
    const mach = m.links.filter((l) => l.part_number_id === p.id).map((l) => m.byId.machines[l.machine_id]).filter(Boolean);
    host.innerHTML = `${c.canEdit() ? `<div class="toolbar"><button class="btn primary sm" data-addop>${UI.icon('plus', 14)} Add operation</button></div>` : ''}
      ${UI.table([{ label: 'Op #', render: (o) => `<b>${esc(o.operation_number)}</b>` }, { label: 'Operation', key: 'operation_name' }, { label: 'Ideal cycle (s)', align: 'right', render: (o) => U.fmtNum(o.ideal_cycle_time_seconds, 1) },
        { label: 'Cycle time per machine', render: (o) => { const cts = m.cycle_times.filter((x) => x.operation_id === o.id); return cts.length ? cts.map((x) => `<span class="chip">${esc((m.byId.machines[x.machine_id] || {}).code)}: ${U.fmtNum(x.cycle_time_seconds, 1)} s</span>`).join(' ') : '<span class="muted">Uses ideal</span>'; } },
        { label: 'Actions', cls: 'actions', render: (o) => (c.canEdit() ? `<button class="icon-btn" data-edit="${o.id}" aria-label="Edit operation">${UI.icon('edit', 16)}</button><button class="icon-btn" data-del="${o.id}" aria-label="Delete operation">${UI.icon('trash', 16)}</button>` : '') }], ops, { empty: 'No operations yet.' })}
      ${mach.length ? '' : '<p class="muted small" style="margin-top:10px">Link machines in the Machines tab to set per-machine cycle times.</p>'}`;
    const a = $('[data-addop]', host); if (a) a.onclick = () => opForm(c, null, mach);
    host.onclick = async (e) => {
      const b = e.target.closest('button[data-edit],button[data-del]'); if (!b) return;
      const o = m.byId.operations[b.dataset.edit || b.dataset.del];
      if (b.dataset.edit) return opForm(c, o, mach);
      if (await UI.confirm({ title: `Delete operation ${o.operation_number}?`, message: 'Its cycle times and defects will be deleted too.', confirmLabel: 'Delete operation', danger: true })) { try { await db.delete('operations', o.id); UI.toast('Operation deleted'); c.refresh(); } catch (er) { UI.toast(UI.errMsg(er), 'err'); } }
    };
  }
  function opForm(c, o, mach) {
    const { m, p } = c, cts = o ? m.cycle_times.filter((x) => x.operation_id === o.id) : [];
    const modal = UI.modal({ title: o ? `Edit operation ${o.operation_number}` : 'Add operation', size: 'md', body: `<form id="of" novalidate><div class="form-grid">
      <div class="field"><label for="of-n">Operation number<span class="req"> *</span></label><input id="of-n" name="n" type="number" min="1" step="1" value="${o ? o.operation_number : ''}"></div>
      <div class="field"><label for="of-t">Ideal cycle time (s)<span class="req"> *</span></label><input id="of-t" name="t" type="number" min="0.1" step="0.1" value="${o ? o.ideal_cycle_time_seconds : ''}"></div>
      <div class="field span-2"><label for="of-m">Operation name<span class="req"> *</span></label><input id="of-m" name="m" value="${esc(o ? o.operation_name : '')}" autocomplete="off"></div></div>
      ${mach.length ? `<h3 class="sec-title" style="margin-top:14px">Cycle time per machine (s)</h3><p class="muted small">Leave empty to use the ideal cycle time.</p><div class="form-grid">${mach.map((x) => { const ct = cts.find((y) => y.machine_id === x.id); return `<div class="field"><label for="ct-${x.id}">${esc(x.code)}</label><input id="ct-${x.id}" data-mc="${x.id}" type="number" min="0.1" step="0.1" value="${ct ? ct.cycle_time_seconds : ''}"></div>`; }).join('')}</div>` : ''}
      <div class="form-error" hidden role="alert"></div></form>`, footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit" form="of">${o ? 'Save changes' : 'Add operation'}</button>` });
    const f = $('#of', modal.body), err = $('.form-error', f);
    f.onsubmit = async (e) => {
      e.preventDefault(); err.hidden = true; const n = Number(f.elements.n.value), t = Number(f.elements.t.value), name = f.elements.m.value.trim();
      const msg = !Number.isInteger(n) || n < 1 ? 'Enter the operation number as a whole number.' : !name ? 'Enter the operation name.' : !(t > 0) ? 'Enter an ideal cycle time greater than 0.' : '';
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      try {
        const payload = { part_number_id: p.id, operation_number: n, operation_name: name, ideal_cycle_time_seconds: t };
        const row = o ? await db.update('operations', o.id, payload) : await db.insert('operations', payload);
        for (const inp of U.$$('[data-mc]', f)) {
          const v = inp.value.trim(), ex = cts.find((y) => y.machine_id === inp.dataset.mc);
          if (v === '') { if (ex) await db.delete('operation_machine_cycle_times', ex.id); }
          else if (!(Number(v) > 0)) throw new Error('Cycle times must be numbers greater than 0.');
          else if (ex) await db.update('operation_machine_cycle_times', ex.id, { cycle_time_seconds: Number(v) });
          else await db.insert('operation_machine_cycle_times', { operation_id: row.id, part_number_id: p.id, machine_id: inp.dataset.mc, cycle_time_seconds: Number(v) });
        }
        UI.toast(o ? 'Operation updated' : 'Operation added'); modal.close(); c.refresh();
      } catch (e2) { err.textContent = UI.errMsg(e2); err.hidden = false; }
    };
  }

  /* ---------- Machines (vincular / desvincular) ---------- */
  function machinesTab(host, c) {
    const { m, p } = c, linked = new Set(m.links.filter((l) => l.part_number_id === p.id).map((l) => l.machine_id));
    host.innerHTML = `<p class="muted small" style="margin-bottom:10px">Choose the machines that can run ${esc(p.part_number)}.${c.canEdit() ? '' : ' (view only)'}</p><div class="master-grid">${m.machines.map((x) => `<label class="master-row check"><span><b>${esc(x.code)}</b> <span class="muted">${esc(x.name)}</span></span><input type="checkbox" data-mach="${x.id}" ${linked.has(x.id) ? 'checked' : ''} ${c.canEdit() ? '' : 'disabled'} aria-label="Link ${esc(x.code)}"></label>`).join('')}</div>`;
    host.onchange = async (e) => {
      const cb = e.target.closest('[data-mach]'); if (!cb) return; cb.disabled = true;
      try {
        if (cb.checked) await db.insert('part_number_machines', { part_number_id: p.id, machine_id: cb.dataset.mach });
        else {
          for (const l of m.links.filter((x) => x.part_number_id === p.id && x.machine_id === cb.dataset.mach)) await db.delete('part_number_machines', l.id);
          for (const ct of m.cycle_times.filter((x) => x.part_number_id === p.id && x.machine_id === cb.dataset.mach)) await db.delete('operation_machine_cycle_times', ct.id);
        }
        G.Cache.invalidate(); c.m.links.length; UI.toast(cb.checked ? 'Machine linked' : 'Machine unlinked'); c.refresh();
      } catch (er) { UI.toast(UI.errMsg(er), 'err'); cb.checked = !cb.checked; cb.disabled = false; }
    };
  }

  G.Pages.parts = {
    async render(host, params) { st.host = host; await draw(); if (params && params[0]) openProfile(params[0]); },
    refresh() { G.Cache.invalidate(); return draw(); }, destroy() { st.token++; st.host = null; }, openProfile
  };
})();
