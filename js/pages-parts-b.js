/* pages-parts-b.js — Part Numbers: pestañas Defects y Barcode del perfil */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;
  const P = (G.PartsUI = G.PartsUI || {});
  const CATS = ['Material', 'Process', 'Handling', 'Tooling', 'Dimensional', 'Cosmetic'];

  /* Defectos de la parte (por operación) + los General (solo lectura) */
  P.defectsTab = async (host, c) => {
    const { m, p } = c; UI.loading(host, 'Loading defects…');
    const cat = await G.Cache.catalogs(true);
    const own = cat.scrap_catalog.filter((d) => d.part_number_id === p.id), gen = cat.scrap_catalog.filter((d) => d.part_number_id == null);
    const opLabel = (id) => { const o = m.byId.operations[id]; return o ? `${o.operation_number} · ${o.operation_name}` : '—'; };
    const ops = m.operations.filter((o) => o.part_number_id === p.id).sort((a, b) => a.operation_number - b.operation_number);
    const rows = [...own.map((d) => ({ d, general: false })), ...gen.map((d) => ({ d, general: true }))];
    host.innerHTML = `${c.canEdit() ? `<form class="defect-form panel-soft" novalidate><h3 class="sec-title">Add defect</h3><div class="form-grid">
        <div class="field"><label for="df-o">Operation<span class="req"> *</span></label><select id="df-o" name="o">${UI.opts(ops, '', { blank: ops.length ? 'Select operation…' : 'Add an operation first', label: (o) => `${o.operation_number} · ${o.operation_name}`, val: (o) => o.id })}</select></div>
        <div class="field"><label for="df-c">Code<span class="req"> *</span></label><input id="df-c" name="c" autocomplete="off" placeholder="e.g. BRK-05"></div>
        <div class="field"><label for="df-d">Defect<span class="req"> *</span></label><input id="df-d" name="d" autocomplete="off"></div>
        <div class="field"><label for="df-k">Category<span class="req"> *</span></label><select id="df-k" name="k">${UI.opts(CATS.map((x) => ({ label: x, value: x })), '', { blank: 'Select category…' })}</select></div></div>
        <div class="form-error" hidden role="alert"></div><div class="btn-row" style="margin-top:12px"><button class="btn primary sm" type="submit">${UI.icon('plus', 14)} Add defect</button></div></form>` : ''}
      ${UI.table([{ label: 'Operation', render: (r) => (r.general ? '<span class="muted">All</span>' : esc(opLabel(r.d.operation_id))) }, { label: 'Code', render: (r) => `<b>${esc(r.d.code)}</b>` }, { label: 'Defect', render: (r) => esc(r.d.defect) + (r.general ? ' <span class="badge info">General — all Part Numbers</span>' : '') }, { label: 'Category', render: (r) => esc(r.d.category) },
        { label: 'Actions', cls: 'actions', render: (r) => (r.general ? '<span class="muted small">Read only</span>' : c.canEdit() ? `<button class="icon-btn" data-del="${r.d.id}" aria-label="Delete defect">${UI.icon('trash', 16)}</button>` : '') }], rows, { empty: 'No defects yet for this part number.' })}`;
    const f = $('.defect-form', host);
    if (f) f.onsubmit = async (e) => {
      e.preventDefault(); const err = $('.form-error', f); err.hidden = true; const v = (n) => f.elements[n].value.trim();
      const msg = !v('o') ? 'Select the operation.' : !v('c') ? 'Enter the defect code.' : !v('d') ? 'Enter the defect name.' : !v('k') ? 'Select a category.' : '';
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      try { await db.insert('scrap_catalog', { part_number_id: p.id, operation_id: v('o'), code: v('c').toUpperCase(), defect: v('d'), category: v('k') }); G.Cache.invalidate(); UI.toast('Defect added'); c.refresh(); } catch (er) { err.textContent = UI.errMsg(er); err.hidden = false; }
    };
    host.onclick = async (e) => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (await UI.confirm({ title: 'Delete this defect?', message: 'It will no longer be offered when capturing scrap.', confirmLabel: 'Delete defect', danger: true })) { try { await db.delete('scrap_catalog', b.dataset.del); G.Cache.invalidate(); UI.toast('Defect deleted'); c.refresh(); } catch (er) { UI.toast(UI.errMsg(er), 'err'); } }
    };
  };

  /* Código de barras Code 39 del número de parte */
  P.barcodeTab = (host, c) => {
    const svg = G.code39Svg(c.p.part_number);
    host.innerHTML = svg ? `<div class="barcode-card"><div class="barcode-box">${svg}</div><p class="muted small">Code 39 · ${esc(c.p.part_number.toUpperCase())}</p><div class="btn-row"><button class="btn sm" data-print>${UI.icon('download', 14)} Print barcode</button></div></div>`
      : `<div class="notice warn">${UI.icon('alert', 16)}<span>This part number has characters Code 39 cannot encode (it supports A–Z, 0–9 and - . space $ / + %). Edit the part number to generate a barcode.</span></div>`;
    const pr = $('[data-print]', host);
    if (pr) pr.onclick = () => { const w = window.open('', '_blank', 'width=520,height=360'); if (!w) { UI.toast('Allow pop-ups to print the barcode.', 'err'); return; } w.document.write(`<title>${esc(c.p.part_number)}</title><body style="margin:24px;text-align:center">${svg.replace('class="barcode-svg"', 'style="width:420px"')}</body>`); w.document.close(); w.focus(); w.print(); };
  };
})();
