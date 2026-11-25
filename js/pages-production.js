/* pages-production.js — Production: tarjetas de máquina, perfil, Start Production, Real Time (hora por hora) y Finish Session */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;
  const state = { host: null, token: 0 };
  const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : '—');
  const SESSION_EMBED = ['machines', 'shifts', 'customers', 'part_numbers', 'operations', 'operator', 'supervisor'];

  /* ---------- Datos (sesiones y conteos SIEMPRE frescos; maestros con caché 60 s) ---------- */
  const loadSessions = () => db.select('machine_production_sessions', { where: { status: 'RUNNING' }, embed: SESSION_EMBED });
  async function loadHourCounts(sessions) {
    if (!sessions.length) return {};
    const rows = await db.select('production_captures', { where: { session_id: sessions.map((s) => s.id), hour_slot: { isnull: false } } });
    const out = {}; rows.forEach((r) => (out[r.session_id] = (out[r.session_id] || 0) + 1)); return out;
  }
  async function loadHourData(sessionId) {
    const caps = await db.select('production_captures', { where: { session_id: sessionId }, order: 'hour_slot' });
    const ids = caps.map((c) => c.id);
    const [se, de] = ids.length ? await Promise.all([db.select('scrap_events', { where: { production_capture_id: ids }, embed: ['scrap_catalog'] }), db.select('downtime_events', { where: { production_capture_id: ids }, embed: ['downtime_catalog'] })]) : [[], []];
    return { caps, se, de };
  }
  /** Defectos disponibles = los de la parte (y operación de la sesión) + los General */
  const defectsFor = (cat, partId, opId) => cat.scrap_catalog.filter((c) => c.part_number_id == null || (c.part_number_id === partId && (!opId || c.operation_id === opId)));

  /* ---------- Recap / totales ---------- */
  function recapHTML(s) {
    const sh = s.shifts, op = s.operations;
    const items = [['Customer', s.customers && s.customers.name], ['Part Number', s.part_numbers && `${s.part_numbers.part_number} · ${s.part_numbers.description || ''}`], ['Operation', op ? `${op.operation_number} · ${op.operation_name}` : '—'], ['Lot', s.lot_number], ['Shift', sh ? `${sh.name} (${G.Shift.windowLabel(sh)})` : '—'], ['Started', U.fmtDateTime(s.started_at)], ['Operator', fullName(s.operator)], ['Supervisor', fullName(s.supervisor)]];
    return `<dl class="recap-grid">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl>`;
  }
  function totals(data) {
    const hours = data.caps.filter((c) => c.hour_slot), pieces = U.sum(data.caps, (c) => c.production_quantity), scrap = U.sum(data.se, (e) => e.quantity), down = U.sum(data.de, (e) => e.minutes);
    return { pieces, scrap, rate: pieces ? scrap / pieces : null, down, logged: hours.length };
  }
  function totalsHTML(t, shift) {
    const total = G.Shift.hasSchedule(shift) ? Math.ceil(G.Shift.durationMin(shift) / 60) : null;
    const it = [['Pieces', U.fmtNum(t.pieces)], ['Scrap', U.fmtNum(t.scrap)], ['Scrap rate', U.pct(t.rate)], ['Downtime', `${U.fmtNum(t.down)} min`], ['Hours logged', total ? `${t.logged} / ${total}` : String(t.logged)]];
    return `<div class="totals-bar">${it.map(([k, v]) => `<div class="tot"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  }

  /* ---------- Formulario de captura (piezas + líneas de scrap y downtime) ---------- */
  function captureForm({ cat, session, slotMinutes, withDate, initial }) {
    const defects = defectsFor(cat, session.part_number_id, session.operation_id);
    const dOpts = `<option value="">Defect…</option>` + defects.map((d) => `<option value="${esc(d.id)}">${esc(d.code)} — ${esc(d.defect)}${d.part_number_id == null ? ' (General)' : ''}</option>`).join('');
    const tOpts = `<option value="">Downtime reason…</option>` + cat.downtime_catalog.map((d) => `<option value="${esc(d.id)}">${esc(d.code)} — ${esc(d.downtime)} (${esc(d.category)})</option>`).join('');
    const el = U.el(`<div class="cap-form">
      <div class="form-grid">${withDate ? `<div class="field"><label>Production date<span class="req"> *</span></label><input type="date" class="cf-date" value="${esc((initial && initial.date) || U.today())}"></div>` : ''}
      <div class="field"><label>Pieces produced (total, incl. scrap)<span class="req"> *</span></label><input type="number" class="cf-qty" min="0" step="1" inputmode="numeric" value="${initial && initial.quantity != null ? initial.quantity : ''}"></div></div>
      <div class="lines"><div class="lines-head"><b>Scrap</b><button type="button" class="btn sm ghost cf-add-scrap">${UI.icon('plus', 14)} Add scrap line</button></div><div class="lines-body cf-scrap"></div></div>
      <div class="lines"><div class="lines-head"><b>Downtime</b><button type="button" class="btn sm ghost cf-add-down">${UI.icon('plus', 14)} Add downtime line</button></div><div class="lines-body cf-down"></div></div>
      <div class="form-error cf-err" hidden role="alert"></div></div>`);
    const scrapHost = $('.cf-scrap', el), downHost = $('.cf-down', el);
    const del = `<button type="button" class="icon-btn ln-del" aria-label="Remove line">${UI.icon('trash', 16)}</button>`;
    const addScrap = (v = {}) => { const r = U.el(`<div class="line-row scrap-line"><select class="input ln-defect" aria-label="Defect">${dOpts}</select><input class="input ln-qty" type="number" min="1" step="1" placeholder="Qty" aria-label="Scrap quantity" value="${v.quantity || ''}"><input class="input ln-reason" placeholder="Reason (optional)" aria-label="Reason" value="${esc(v.reason || '')}">${del}</div>`); if (v.scrap_catalog_id) $('.ln-defect', r).value = v.scrap_catalog_id; scrapHost.appendChild(r); };
    const addDown = (v = {}) => { const r = U.el(`<div class="line-row down-line"><select class="input ln-reasonid" aria-label="Downtime reason">${tOpts}</select><input class="input ln-min" type="number" min="1" step="1" placeholder="Minutes" aria-label="Minutes" value="${v.minutes || ''}"><select class="input ln-type" aria-label="Type"><option value="Unplanned"${v.event_type === 'Planned' ? '' : ' selected'}>Unplanned</option><option value="Planned"${v.event_type === 'Planned' ? ' selected' : ''}>Planned</option></select><input class="input ln-reason" placeholder="Reason (optional)" aria-label="Reason" value="${esc(v.reason || '')}">${del}</div>`); if (v.downtime_catalog_id) $('.ln-reasonid', r).value = v.downtime_catalog_id; downHost.appendChild(r); };
    $('.cf-add-scrap', el).onclick = () => addScrap(); $('.cf-add-down', el).onclick = () => addDown();
    el.addEventListener('click', (e) => { const b = e.target.closest('.ln-del'); if (b) b.closest('.line-row').remove(); });
    ((initial && initial.scrap) || []).forEach(addScrap); ((initial && initial.downtime) || []).forEach(addDown);
    const err = (msg) => { const x = $('.cf-err', el); x.hidden = !msg; x.textContent = msg || ''; return null; };
    el.read = () => {
      err('');
      const qraw = $('.cf-qty', el).value.trim(), qty = Number(qraw);
      if (qraw === '' || !Number.isInteger(qty) || qty < 0) return err('Enter the pieces produced as a whole number (0 or more).');
      const scrap = [], down = [];
      for (const r of U.$$('.scrap-line', el)) {
        const d = $('.ln-defect', r).value, q = $('.ln-qty', r).value.trim(), why = $('.ln-reason', r).value.trim();
        if (!d && !q && !why) continue;
        if (!d || !/^\d+$/.test(q) || Number(q) < 1) return err('Complete every scrap line: choose a defect and a quantity of 1 or more.');
        scrap.push({ scrap_catalog_id: d, quantity: Number(q), reason: why || null });
      }
      for (const r of U.$$('.down-line', el)) {
        const d = $('.ln-reasonid', r).value, m = $('.ln-min', r).value.trim(), why = $('.ln-reason', r).value.trim();
        if (!d && !m && !why) continue;
        if (!d || !/^\d+$/.test(m) || Number(m) < 1) return err('Complete every downtime line: choose a reason and minutes of 1 or more.');
        down.push({ downtime_catalog_id: d, minutes: Number(m), event_type: $('.ln-type', r).value, reason: why || null });
      }
      const sc = U.sum(scrap, (s) => s.quantity); if (sc > qty) return err(`Scrap (${sc}) cannot exceed the pieces produced (${qty}).`);
      const dm = U.sum(down, (s) => s.minutes); if (slotMinutes && dm > slotMinutes) return err(`Downtime (${dm} min) cannot exceed the ${slotMinutes} minutes of this hour.`);
      return { quantity: qty, scrap, downtime: down, date: withDate ? $('.cf-date', el).value || U.today() : null };
    };
    el.showError = err;
    return el;
  }

  /* ---------- Lista de horas del turno (Real Time y revisión) ---------- */
  function mountHours(host, o) {
    const st = { data: null, editing: null };
    const shift = o.session.shifts || o.master.byId.shifts[o.session.shift_id];
    async function load() { host.innerHTML = '<div class="state state-loading"><span class="spinner"></span><span>Loading hours…</span></div>'; try { st.data = await loadHourData(o.session.id); render(); if (o.onChange) o.onChange(st.data); } catch (e) { UI.error(host, e, load); } }
    function render() {
      const { slots, hidden, noSchedule } = G.Shift.hours(shift, o.session.started_at);
      const capBy = {}; st.data.caps.filter((c) => c.hour_slot).forEach((c) => (capBy[c.hour_slot] = c));
      const edit = o.editable(), canDel = o.allowDelete && edit;
      const notes = [];
      if (noSchedule) notes.push('This shift has no schedule defined — showing calendar hours from the session start.');
      if (hidden) notes.push(`${hidden} earlier hour${hidden > 1 ? 's are' : ' is'} not shown, but still counted in the totals.`);
      host.innerHTML = `${notes.map((n) => `<div class="notice warn">${UI.icon('alert', 16)}<span>${esc(n)}</span></div>`).join('')}
        <div class="hours-list">${slots.length ? slots.map((sl) => {
          const cap = capBy[sl.key], se = cap ? st.data.se.filter((e) => e.production_capture_id === cap.id) : [], de = cap ? st.data.de.filter((e) => e.production_capture_id === cap.id) : [];
          return `<div class="hour-block" data-key="${esc(sl.key)}"><div class="hour-row ${cap ? 'logged' : ''}"><div class="hr-range">${esc(G.Shift.slotLabel(sl))}${sl.minutes < 60 ? ` <span class="muted small">(${sl.minutes} min)</span>` : ''}</div>
            <div class="hr-vals">${cap ? `<span><b>${U.fmtNum(cap.production_quantity)}</b> pcs</span><span><b>${U.fmtNum(U.sum(se, (e) => e.quantity))}</b> scrap</span><span><b>${U.fmtNum(U.sum(de, (e) => e.minutes))}</b> min down</span>` : '<span class="muted">Not logged</span>'}</div>
            <div class="hr-actions">${edit ? (cap ? `<button class="btn sm" data-edit>${UI.icon('edit', 14)} Edit</button>${canDel ? `<button class="btn sm danger" data-del>${UI.icon('trash', 14)} Delete</button>` : ''}` : `<button class="btn sm primary" data-edit>${UI.icon('plus', 14)} Add</button>`) : ''}</div></div>
            <div class="hour-editor" hidden></div></div>`;
        }).join('') : '<div class="state state-empty"><span>The shift has not produced any hour yet.</span></div>'}</div>`;
      U.$$('.hour-block', host).forEach((blk) => {
        const key = blk.dataset.key, slot = slots.find((s) => s.key === key);
        const eb = $('[data-edit]', blk); if (eb) eb.onclick = () => openEditor(blk, slot, capBy[key]);
        const db2 = $('[data-del]', blk); if (db2) db2.onclick = async () => { if (await UI.confirm({ title: 'Delete this hour?', message: `The hour ${esc(G.Shift.slotLabel(slot))} and its scrap and downtime lines will be removed.`, confirmLabel: 'Delete hour', danger: true })) { try { await db.deleteHour(o.session.id, key); UI.toast('Hour deleted'); await load(); } catch (e) { UI.toast(UI.errMsg(e), 'err'); } } };
        if (st.editing === key) openEditor(blk, slot, capBy[key]);
      });
    }
    function openEditor(blk, slot, cap) {
      U.$$('.hour-editor', host).forEach((x) => { x.hidden = true; x.innerHTML = ''; });
      st.editing = slot.key; const box = $('.hour-editor', blk); box.hidden = false;
      const initial = cap ? { quantity: cap.production_quantity, scrap: st.data.se.filter((e) => e.production_capture_id === cap.id), downtime: st.data.de.filter((e) => e.production_capture_id === cap.id) } : null;
      const form = captureForm({ cat: o.cat, session: o.session, slotMinutes: slot.minutes, initial });
      const bar = U.el(`<div class="btn-row editor-actions"><button class="btn primary sm" data-save>${UI.icon('check', 14)} Save hour</button><button class="btn ghost sm" data-cancel>Cancel</button></div>`);
      box.appendChild(form); box.appendChild(bar);
      $('[data-cancel]', bar).onclick = () => { st.editing = null; box.hidden = true; box.innerHTML = ''; };
      $('[data-save]', bar).onclick = async (ev) => {
        const v = form.read(); if (!v) return; const btn = ev.currentTarget; btn.disabled = true;
        try { await db.saveHour({ session_id: o.session.id, hour_slot: slot.key, quantity: v.quantity, scrap: v.scrap, downtime: v.downtime }); st.editing = null; UI.toast(`Hour ${G.Shift.slotLabel(slot)} saved`); await load(); }
        catch (e) { form.showError(UI.errMsg(e)); btn.disabled = false; }
      };
      const f = $('.cf-qty', form); if (f) f.focus();
    }
    load();
    return { reload: load, render: () => st.data && render(), data: () => st.data };
  }

  /* ---------- Real Time ---------- */
  async function openRealTime(session) {
    const [master, cat] = await Promise.all([G.Cache.master(), G.Cache.catalogs()]);
    const mach = session.machines;
    const modal = UI.modal({ title: `Real Time — ${mach.code}`, subtitle: `${session.part_numbers.part_number} · Lot ${session.lot_number}`, size: 'xl', body: '<div class="rt-recap"></div><div class="rt-tot"></div><div class="rt-hours"></div>', onClose: () => draw() });
    $('.rt-recap', modal.body).innerHTML = recapHTML(session);
    mountHours($('.rt-hours', modal.body), { session, master, cat, editable: () => G.can('capture'), allowDelete: false, onChange: (d) => { $('.rt-tot', modal.body).innerHTML = totalsHTML(totals(d), session.shifts); } });
    return modal;
  }

  /* ---------- Finish Session ---------- */
  async function openFinish(session, parent) {
    const [master, cat, data] = await Promise.all([G.Cache.master(), G.Cache.catalogs(), loadHourData(session.id)]);
    const hasHours = data.caps.some((c) => c.hour_slot);
    const modal = UI.modal({ title: `Finish session — ${session.machines.code}`, subtitle: `${session.part_numbers.part_number} · Lot ${session.lot_number}`, size: 'xl', body: '' });
    const done = (msg) => { UI.toast(msg); modal.close(); if (parent) parent.close(); };
    const classic = (replace) => {
      modal.setBody(`${recapHTML(session)}${replace ? `<div class="notice warn">${UI.icon('alert', 16)}<span>Saving will <b>delete all ${data.caps.filter((c) => c.hour_slot).length} Real Time hours</b> of this session and keep only this single capture.</span></div>` : ''}<h3 class="sec-title">Final capture</h3><div class="classic-host"></div>`);
      const form = captureForm({ cat, session, slotMinutes: null, withDate: true });
      $('.classic-host', modal.body).appendChild(form);
      modal.setFooter(`<button class="btn ghost" data-back>${hasHours ? 'Back to review' : 'Cancel'}</button><button class="btn primary" data-save>Save and finish session</button>`);
      $('[data-back]', modal.foot).onclick = () => (hasHours ? review() : modal.close());
      $('[data-save]', modal.foot).onclick = async (ev) => {
        const v = form.read(); if (!v) return; const b = ev.currentTarget; b.disabled = true;
        try { await db.finishSessionSingle(session.id, { production_date: v.date, quantity: v.quantity, scrap: v.scrap, downtime: v.downtime }); done('Session finished — 1 capture saved to Registers'); }
        catch (e) { form.showError(UI.errMsg(e)); b.disabled = false; }
      };
    };
    const review = () => {
      modal.setBody(`${recapHTML(session)}<div class="rt-tot"></div>
        <div class="review-tools"><label class="check"><input type="checkbox" id="fin-sub"> <span><b>Substitute information</b><br><span class="muted small">Enable editing, deleting and adding hours before you finish.</span></span></label>
        <button class="btn sm ghost" id="fin-single">Single Entry — replace with one capture</button></div><div class="rev-hours"></div>`);
      const sub = $('#fin-sub', modal.body);
      const hl = mountHours($('.rev-hours', modal.body), { session, master, cat, editable: () => sub.checked && G.can('capture'), allowDelete: true, onChange: (d) => { data.caps = d.caps; data.se = d.se; data.de = d.de; $('.rt-tot', modal.body).innerHTML = totalsHTML(totals(d), session.shifts); } });
      sub.onchange = () => hl.render();
      $('#fin-single', modal.body).onclick = async () => { if (await UI.confirm({ title: 'Replace with a single capture?', message: 'All Real Time hours of this session will be deleted when you save the single capture. This cannot be undone.', confirmLabel: 'Continue', danger: true })) classic(true); };
      modal.setFooter(`<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-fin>${UI.icon('check', 16)} Confirm and Finish Session</button>`);
      $('[data-fin]', modal.foot).onclick = async (ev) => {
        const b = ev.currentTarget;
        if (!(hl.data() && hl.data().caps.some((c) => c.hour_slot))) { UI.toast('There are no hours logged — use Single Entry to finish.', 'err'); return; }
        if (!(await UI.confirm({ title: 'Finish this session?', message: 'The hours will be consolidated into <b>one capture</b> in Registers and the session will be closed.', confirmLabel: 'Finish session' }))) return;
        b.disabled = true;
        try { const cap = await db.consolidateAndFinish(session.id); done(`Session finished — ${U.fmtNum(cap.production_quantity)} pieces saved as 1 capture`); }
        catch (e) { UI.toast(UI.errMsg(e), 'err'); b.disabled = false; }
      };
    };
    hasHours ? review() : classic(false);
    return modal;
  }

  /* ---------- Start Production ---------- */
  function startForm(modal, mach, m, paint) {
    const linked = m.links.filter((l) => l.machine_id === mach.id).map((l) => m.byId.part_numbers[l.part_number_id]).filter(Boolean);
    const custs = m.customers.filter((c) => linked.some((p) => p.customer_id === c.id));
    const operators = m.personnel.filter((p) => p.is_active && p.role === 'Operator'), sups = m.personnel.filter((p) => p.is_active && p.role === 'Supervisor');
    const el = U.el(`<form class="start-form" novalidate><h3 class="sec-title">Start Production</h3>
      <div class="form-grid">
        <div class="field"><label>Shift<span class="req"> *</span></label><select name="shift">${UI.opts(m.shifts, '', { blank: 'Select shift…', label: (s) => `${s.code} — ${s.name} (${G.Shift.windowLabel(s)})`, val: (s) => s.id })}</select></div>
        <div class="field"><label>Customer<span class="req"> *</span></label><select name="customer">${UI.opts(custs, '', { blank: 'Select customer…', label: (c) => `${c.code} — ${c.name}`, val: (c) => c.id })}</select></div>
        <div class="field"><label>Part Number<span class="req"> *</span></label><select name="part" disabled><option value="">Select customer first…</option></select></div>
        <div class="field"><label>Lot Number<span class="req"> *</span></label><input name="lot" autocomplete="off" placeholder="e.g. LT-261120-01"></div>
        <div class="field"><label>Operation</label><select name="op" disabled><option value="">Select part number first…</option></select><span class="hint op-hint"></span></div>
        <div class="field"><label>Operator</label><select name="operator">${UI.opts(operators, '', { blank: '— None —', label: fullName, val: (p) => p.id })}</select></div>
        <div class="field"><label>Supervisor</label><select name="supervisor">${UI.opts(sups, '', { blank: '— None —', label: fullName, val: (p) => p.id })}</select></div>
      </div><div class="form-error" hidden role="alert"></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn primary" type="submit">${UI.icon('play', 16)} Start production</button></div></form>`);
    const f = (n) => el.elements[n];
    const setParts = () => { const parts = linked.filter((p) => p.customer_id === f('customer').value); f('part').disabled = !parts.length; f('part').innerHTML = UI.opts(parts, '', { blank: parts.length ? 'Select part number…' : 'No parts linked for this customer', label: (p) => `${p.part_number} — ${p.description || ''}`, val: (p) => p.id }); setOps(); };
    const setOps = () => {
      const p = m.byId.part_numbers[f('part').value], sel = f('op'), hint = $('.op-hint', el);
      if (!p) { sel.disabled = true; sel.innerHTML = '<option value="">Select part number first…</option>'; hint.textContent = ''; return; }
      const all = m.operations.filter((o) => o.part_number_id === p.id).sort((a, b) => a.operation_number - b.operation_number);
      const withCt = all.filter((o) => m.cycle_times.some((c) => c.operation_id === o.id && c.machine_id === mach.id));
      const list = withCt.length ? withCt : all;
      sel.disabled = !list.length; sel.innerHTML = list.length ? UI.opts(list, list[0].id, { label: (o) => `${o.operation_number} — ${o.operation_name}`, val: (o) => o.id }) : '<option value="">This part has no operations</option>';
      hint.textContent = withCt.length && withCt.length < all.length ? 'Only operations with a cycle time on this machine are shown.' : '';
    };
    f('customer').onchange = setParts; f('part').onchange = setOps;
    el.onsubmit = async (e) => {
      e.preventDefault(); const err = $('.form-error', el); err.hidden = true;
      const bad = !f('shift').value ? 'Select a shift.' : !f('customer').value ? 'Select a customer.' : !f('part').value ? 'Select a part number.' : !f('lot').value.trim() ? 'Enter the lot number.' : '';
      if (bad) { err.textContent = bad; err.hidden = false; return; }
      const btn = $('button[type=submit]', el); btn.disabled = true;
      try {
        await db.startSession({ machine_id: mach.id, shift_id: f('shift').value, customer_id: f('customer').value, part_number_id: f('part').value, operation_id: f('op').value || null, lot_number: f('lot').value.trim(), operator_id: f('operator').value || null, supervisor_id: f('supervisor').value || null });
        UI.toast(`Production started on ${mach.code}`); await paint();
      } catch (e2) { err.textContent = UI.errMsg(e2); err.hidden = false; btn.disabled = false; if (e2.code === 'MACHINE_BUSY') { UI.toast(UI.errMsg(e2), 'err'); await paint(); } }
    };
    return el;
  }

  /* ---------- Perfil de máquina ---------- */
  async function openProfile(machineId) {
    const m = await G.Cache.master(), mach = m.byId.machines[machineId];
    if (!mach) { UI.toast('That machine could not be found.', 'err'); return; }
    const modal = UI.modal({ title: `${mach.code} — ${mach.name}`, subtitle: mach.brand ? `Brand: ${mach.brand}` : '', size: 'lg', body: '<div class="state state-loading"><span class="spinner"></span></div>', onClose: () => draw() });
    const paint = async () => {
      const sessions = await loadSessions(), s = sessions.find((x) => x.machine_id === mach.id);
      const parts = m.links.filter((l) => l.machine_id === mach.id).map((l) => m.byId.part_numbers[l.part_number_id]).filter(Boolean);
      const head = `<div class="profile-head"><span class="badge ${s ? 'run' : 'idle'}">${s ? 'RUNNING' : 'IDLE'}</span><span class="muted">Linked part numbers:</span>${parts.length ? parts.map((p) => `<span class="chip">${esc(p.part_number)}</span>`).join('') : '<span class="muted">None</span>'}</div>`;
      modal.setFooter('');
      if (s) {
        const mayCapture = G.can('capture');
        modal.setBody(`${head}<h3 class="sec-title">Active session</h3>${recapHTML(s)}${mayCapture ? '' : `<div class="notice">${UI.icon('alert', 16)}<span>Your role can view sessions but not capture production.</span></div>`}<div class="btn-row" style="margin-top:16px">${mayCapture ? `<button class="btn brand" data-rt>${UI.icon('clock', 16)} Real Time</button><button class="btn primary" data-fin>${UI.icon('check', 16)} Finish Session</button>` : ''}</div>`);
        const rt = $('[data-rt]', modal.body), fin = $('[data-fin]', modal.body);
        if (rt) rt.onclick = () => openRealTime(s);
        if (fin) fin.onclick = () => openFinish(s, modal);
      } else if (!G.can('capture')) {
        modal.setBody(`${head}<div class="state state-empty">${UI.icon('sparkles', 28)}<span>This machine is idle. Your role can view production but not start sessions.</span></div>`);
      } else {
        modal.setBody(head); modal.body.appendChild(startForm(modal, mach, m, paint));
      }
    };
    await paint(); return modal;
  }

  /* ---------- Página ---------- */
  async function draw() {
    const host = state.host; if (!host || !host.isConnected) return;
    const tk = ++state.token;
    try {
      const [m, sessions] = await Promise.all([G.Cache.master(), loadSessions()]);
      const counts = await loadHourCounts(sessions); if (tk !== state.token) return;
      const bySess = Object.fromEntries(sessions.map((s) => [s.machine_id, s]));
      const running = m.machines.filter((x) => bySess[x.id]).length;
      host.innerHTML = `<div class="toolbar"><span class="chip">${running} running</span><span class="chip idle-chip">${m.machines.length - running} idle</span><span class="muted small grow">Tap a machine to see its profile, start production or log hours.</span></div>
        <div class="grid auto machine-grid">${m.machines.length ? m.machines.map((x) => {
          const s = bySess[x.id], n = s ? counts[s.id] || 0 : 0;
          return `<button class="machine-card ${s ? 'is-running' : 'is-idle'}" data-id="${esc(x.id)}" aria-label="${esc(x.code)} ${s ? 'running' : 'idle'}"><div class="mc-head"><div><b class="mc-code">${esc(x.code)}</b><span class="muted">${esc(x.name)}</span></div><span class="badge ${s ? 'run' : 'idle'}">${s ? 'RUNNING' : 'IDLE'}</span></div>
            ${s ? `<dl class="mc-sess"><div><dt>Customer</dt><dd>${esc(s.customers.name)}</dd></div><div><dt>Part</dt><dd>${esc(s.part_numbers.part_number)}</dd></div><div><dt>Lot</dt><dd>${esc(s.lot_number)}</dd></div><div><dt>Shift</dt><dd>${esc(s.shifts.code)}</dd></div></dl>${n ? `<span class="chip">${n} hour${n > 1 ? 's' : ''} logged (Real Time)</span>` : ''}` : `<p class="muted mc-idle">No active session${G.can('capture') ? ' — tap to start production.' : '.'}</p>`}</button>`;
        }).join('') : '<div class="state state-empty"><span>No machines yet. Add one in Machines.</span></div>'}</div>`;
      U.$$('.machine-card', host).forEach((c) => (c.onclick = () => openProfile(c.dataset.id)));
      UI.stagger($('.machine-grid', host));
    } catch (e) { console.error(e); UI.error(host, e, draw); }
  }

  G.Pages.production = {
    noStagger: true,
    async render(host, params) { state.host = host; await draw(); if (params && params[0]) openProfile(params[0]); },
    refresh() { G.Cache.invalidate(); return draw(); },
    destroy() { state.token++; state.host = null; },
    openProfile
  };
  G.defectsFor = defectsFor;
})();
