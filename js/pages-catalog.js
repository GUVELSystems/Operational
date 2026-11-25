/* pages-catalog.js — Catalog: Scrap Catalog (con defectos General) y Downtime Catalog */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;
  const DT_CATS = ['Machine', 'Tooling', 'Quality', 'Setup', 'Personnel', 'Logistics', 'Material'];
  const SC_CATS = ['Material', 'Process', 'Handling', 'Tooling', 'Dimensional', 'Cosmetic'];
  const st = { host: null, tab: 'scrap', q: '', part: '', editId: null, token: 0 };

  /** Defectos disponibles = los de la parte (y operación) + los General. Puro: sirve a producción y pruebas. */
  G.availableDefects = (catalogs, partNumberId, operationId) => catalogs.scrap_catalog.filter((c) => c.part_number_id == null || (c.part_number_id === partNumberId && (!operationId || c.operation_id === operationId)));

  const label = (row, m) => (row.part_number_id == null ? 'General — all Part Numbers' : ((m.byId.part_numbers[row.part_number_id] || {}).part_number || '—'));

  async function draw() {
    const host = st.host; if (!host || !host.isConnected) return;
    const tk = ++st.token;
    try {
      const [m, cat] = await Promise.all([G.Cache.master(), G.Cache.catalogs(true)]);
      if (tk !== st.token) return;
      const canEdit = G.can('masters');
      host.innerHTML = `<div class="notice">${UI.icon('alert', 16)}<span>Operations are managed only from the Part Number profile (Part Numbers → Operations). Here you maintain the defects and downtime reasons used when capturing production.</span></div>
        <div class="toolbar" style="margin-top:14px"><div class="tabs" role="tablist"><button class="tab ${st.tab === 'scrap' ? 'active' : ''}" role="tab" data-tab="scrap">Scrap Catalog <span class="count">${cat.scrap_catalog.length}</span></button><button class="tab ${st.tab === 'down' ? 'active' : ''}" role="tab" data-tab="down">Downtime Catalog <span class="count">${cat.downtime_catalog.length}</span></button></div></div>
        ${canEdit ? '' : `<div class="notice warn" style="margin-bottom:14px">${UI.icon('alert', 16)}<span>Your role can view the catalog but not change it.</span></div>`}
        <div id="cat-body"></div>`;
      U.$$('[data-tab]', host).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; st.editId = null; st.q = ''; st.part = ''; draw(); }));
      if (st.tab === 'scrap') scrapTab($('#cat-body', host), m, cat, canEdit); else downTab($('#cat-body', host), cat, canEdit);
    } catch (e) { console.error(e); UI.error(host, e, draw); }
  }

  /* ---------- Scrap Catalog ---------- */
  function scrapTab(box, m, cat, canEdit) {
    const edit = st.editId ? cat.scrap_catalog.find((r) => r.id === st.editId) : null;
    const isGen = edit ? edit.part_number_id == null : false;
    box.innerHTML = `${canEdit ? `<form class="panel cat-form" id="sc-form" novalidate><div class="panel-head"><h2>${edit ? 'Edit defect' : 'Add a defect'}</h2></div>
      <label class="check" style="margin-bottom:14px"><input type="checkbox" name="general" ${isGen ? 'checked' : ''}><span><b>General</b> — applies to every Part Number, including new ones added later (ignores Operation)</span></label>
      <div class="form-grid">
        <div class="field"><label>Part Number<span class="req"> *</span></label><select name="part">${UI.opts(m.part_numbers, edit && edit.part_number_id, { blank: 'Select part number…', label: (p) => `${p.part_number} — ${p.description || ''}`, val: (p) => p.id })}</select></div>
        <div class="field"><label>Operation<span class="req"> *</span></label><select name="op"></select></div>
        <div class="field"><label>Code<span class="req"> *</span></label><input name="code" autocomplete="off" value="${esc(edit ? edit.code : '')}"></div>
        <div class="field"><label>Defect<span class="req"> *</span></label><input name="defect" autocomplete="off" value="${esc(edit ? edit.defect : '')}"></div>
        <div class="field"><label>Category<span class="req"> *</span></label><input name="category" list="sc-cats" autocomplete="off" value="${esc(edit ? edit.category : '')}"><datalist id="sc-cats">${SC_CATS.map((c) => `<option value="${c}">`).join('')}</datalist></div>
      </div><div class="form-error" hidden role="alert" style="margin-top:12px"></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn primary" type="submit">${edit ? 'Save changes' : `${UI.icon('plus', 16)} Add defect`}</button>${edit ? '<button class="btn ghost" type="button" data-cancel>Cancel</button>' : ''}</div></form>` : ''}
      <div class="panel" style="margin-top:16px"><div class="toolbar"><div class="search-input grow"><span>${UI.icon('search', 16)}</span><input type="search" id="sc-q" placeholder="Search code, defect, category or part…" aria-label="Search defects" value="${esc(st.q)}"></div>
        <select class="input" id="sc-part" style="width:auto;max-width:260px" aria-label="Filter by part number"><option value="">All part numbers</option><option value="__general"${st.part === '__general' ? ' selected' : ''}>General only</option>${UI.opts(m.part_numbers, st.part, { label: (p) => p.part_number, val: (p) => p.id })}</select></div><div id="sc-table"></div></div>`;
    const tbl = () => {
      const q = U.norm(st.q);
      const rows = cat.scrap_catalog.filter((r) => (!st.part || (st.part === '__general' ? r.part_number_id == null : r.part_number_id === st.part)) && (!q || U.norm(`${r.code} ${r.defect} ${r.category} ${label(r, m)}`).includes(q)))
        .sort((a, b) => (a.part_number_id == null ? 0 : 1) - (b.part_number_id == null ? 0 : 1) || a.code.localeCompare(b.code));
      $('#sc-table', box).innerHTML = UI.table([
        { label: 'Code', render: (r) => `<b>${esc(r.code)}</b>` }, { label: 'Defect', key: 'defect' }, { label: 'Category', render: (r) => UI.badge(r.category, 'info') },
        { label: 'Part Number', render: (r) => (r.part_number_id == null ? UI.badge('General — all Part Numbers', 'watch') : esc(label(r, m))) },
        { label: 'Operation', render: (r) => { const o = r.operation_id ? m.byId.operations[r.operation_id] : null; return o ? `${esc(o.operation_number)} · ${esc(o.operation_name)}` : '<span class="muted">—</span>'; } },
        { label: '', cls: 'actions', render: (r) => (canEdit ? `<button class="icon-btn" data-edit="${esc(r.id)}" aria-label="Edit ${esc(r.code)}">${UI.icon('edit', 16)}</button><button class="icon-btn" data-del="${esc(r.id)}" aria-label="Delete ${esc(r.code)}">${UI.icon('trash', 16)}</button>` : '') }
      ], rows, { empty: 'No defects match your search.' });
      U.$$('[data-edit]', box).forEach((b) => (b.onclick = () => { st.editId = b.dataset.edit; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
      U.$$('[data-del]', box).forEach((b) => (b.onclick = () => delRow('scrap_catalog', b.dataset.del, 'defect')));
    };
    tbl();
    $('#sc-q', box).oninput = U.debounce((e) => { st.q = e.target.value; tbl(); }, 150);
    $('#sc-part', box).onchange = (e) => { st.part = e.target.value; tbl(); };
    if (!canEdit) return;
    const f = $('#sc-form', box), el = f.elements;
    const syncOps = () => {
      const gen = el.general.checked, p = el.part.value;
      el.part.disabled = gen; el.op.disabled = gen || !p;
      const ops = m.operations.filter((o) => o.part_number_id === p).sort((a, b) => a.operation_number - b.operation_number);
      el.op.innerHTML = gen ? '<option value="">Not used for General</option>' : UI.opts(ops, edit && edit.operation_id, { blank: p ? 'Select operation…' : 'Select part number first…', label: (o) => `${o.operation_number} — ${o.operation_name}`, val: (o) => o.id });
    };
    el.general.onchange = syncOps; el.part.onchange = syncOps; syncOps();
    const c = $('[data-cancel]', f); if (c) c.onclick = () => { st.editId = null; draw(); };
    f.onsubmit = async (ev) => {
      ev.preventDefault(); const err = $('.form-error', f); err.hidden = true;
      const gen = el.general.checked, row = { code: el.code.value.trim(), defect: el.defect.value.trim(), category: el.category.value.trim(), part_number_id: gen ? null : el.part.value || null, operation_id: gen ? null : el.op.value || null };
      const bad = !gen && !row.part_number_id ? 'Select a part number, or tick General.' : !gen && !row.operation_id ? 'Select an operation.' : !row.code ? 'Enter the defect code.' : !row.defect ? 'Enter the defect name.' : !row.category ? 'Enter a category.' : '';
      if (bad) { err.textContent = bad; err.hidden = false; return; }
      const dup = cat.scrap_catalog.some((x) => x.id !== (edit && edit.id) && U.norm(x.code) === U.norm(row.code) && (gen ? x.part_number_id == null : x.part_number_id === row.part_number_id && (x.operation_id || null) === (row.operation_id || null)));
      if (dup) { err.textContent = gen ? 'That code already exists as a General defect.' : 'That defect code already exists for this operation.'; err.hidden = false; return; }
      const btn = $('button[type=submit]', f); btn.disabled = true;
      try { if (edit) await db.update('scrap_catalog', edit.id, row); else await db.insert('scrap_catalog', row); UI.toast(edit ? 'Defect updated' : gen ? 'General defect added — available for every part number' : 'Defect added'); st.editId = null; draw(); }
      catch (e) { err.textContent = UI.errMsg(e); err.hidden = false; btn.disabled = false; }
    };
  }

  /* ---------- Downtime Catalog ---------- */
  function downTab(box, cat, canEdit) {
    const edit = st.editId ? cat.downtime_catalog.find((r) => r.id === st.editId) : null;
    box.innerHTML = `${canEdit ? `<form class="panel cat-form" id="dt-form" novalidate><div class="panel-head"><h2>${edit ? 'Edit downtime reason' : 'Add a downtime reason'}</h2></div>
      <div class="form-grid"><div class="field"><label>Code<span class="req"> *</span></label><input name="code" autocomplete="off" value="${esc(edit ? edit.code : '')}"></div>
        <div class="field"><label>Downtime<span class="req"> *</span></label><input name="downtime" autocomplete="off" value="${esc(edit ? edit.downtime : '')}"></div>
        <div class="field"><label>Category<span class="req"> *</span></label><select name="category">${UI.opts(DT_CATS.map((c) => ({ label: c, value: c })), edit && edit.category, { blank: 'Select category…' })}</select></div></div>
      <div class="form-error" hidden role="alert" style="margin-top:12px"></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn primary" type="submit">${edit ? 'Save changes' : `${UI.icon('plus', 16)} Add reason`}</button>${edit ? '<button class="btn ghost" type="button" data-cancel>Cancel</button>' : ''}</div></form>` : ''}
      <div class="panel" style="margin-top:16px"><div class="toolbar"><div class="search-input grow"><span>${UI.icon('search', 16)}</span><input type="search" id="dt-q" placeholder="Search code, reason or category…" aria-label="Search downtime reasons" value="${esc(st.q)}"></div></div><div id="dt-table"></div></div>`;
    const tbl = () => {
      const q = U.norm(st.q), rows = cat.downtime_catalog.filter((r) => !q || U.norm(`${r.code} ${r.downtime} ${r.category}`).includes(q)).sort((a, b) => a.code.localeCompare(b.code));
      $('#dt-table', box).innerHTML = UI.table([{ label: 'Code', render: (r) => `<b>${esc(r.code)}</b>` }, { label: 'Downtime', key: 'downtime' }, { label: 'Category', render: (r) => UI.badge(r.category, 'info') },
        { label: '', cls: 'actions', render: (r) => (canEdit ? `<button class="icon-btn" data-edit="${esc(r.id)}" aria-label="Edit ${esc(r.code)}">${UI.icon('edit', 16)}</button><button class="icon-btn" data-del="${esc(r.id)}" aria-label="Delete ${esc(r.code)}">${UI.icon('trash', 16)}</button>` : '') }], rows, { empty: 'No downtime reasons match your search.' });
      U.$$('[data-edit]', box).forEach((b) => (b.onclick = () => { st.editId = b.dataset.edit; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
      U.$$('[data-del]', box).forEach((b) => (b.onclick = () => delRow('downtime_catalog', b.dataset.del, 'downtime reason')));
    };
    tbl(); $('#dt-q', box).oninput = U.debounce((e) => { st.q = e.target.value; tbl(); }, 150);
    if (!canEdit) return;
    const f = $('#dt-form', box), el = f.elements, c = $('[data-cancel]', f);
    if (c) c.onclick = () => { st.editId = null; draw(); };
    f.onsubmit = async (ev) => {
      ev.preventDefault(); const err = $('.form-error', f); err.hidden = true;
      const row = { code: el.code.value.trim(), downtime: el.downtime.value.trim(), category: el.category.value };
      const bad = !row.code ? 'Enter the downtime code.' : !row.downtime ? 'Enter the downtime reason.' : !row.category ? 'Select a category.' : '';
      if (bad) { err.textContent = bad; err.hidden = false; return; }
      const btn = $('button[type=submit]', f); btn.disabled = true;
      try { if (edit) await db.update('downtime_catalog', edit.id, row); else await db.insert('downtime_catalog', row); UI.toast(edit ? 'Downtime reason updated' : 'Downtime reason added'); st.editId = null; draw(); }
      catch (e) { err.textContent = UI.errMsg(e); err.hidden = false; btn.disabled = false; }
    };
  }

  async function delRow(table, id, what) {
    if (!(await UI.confirm({ title: `Delete this ${what}?`, message: `The ${what} will be removed from the catalog. If it is already used in captures, it cannot be deleted.`, confirmLabel: 'Delete', danger: true }))) return;
    try { await db.delete(table, id); UI.toast(`${what.charAt(0).toUpperCase() + what.slice(1)} deleted`); draw(); } catch (e) { UI.toast(UI.errMsg(e), 'err'); }
  }

  G.Pages.catalog = {
    async render(host) { st.host = host; st.editId = null; await draw(); },
    refresh() { G.Cache.invalidate(); return draw(); },
    destroy() { st.token++; st.host = null; }
  };
})();
