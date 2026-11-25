/* machine-panel.js — Dashboard de máquina a pantalla completa (Plant Now → clic en una celda)
   Contenedor exterior estable (.machine-panel, entra a Fullscreen) + hijo .mp-content que se redibuja.
   Contrato: G.Calc.sessionMetrics(sessionId) → {hasHours, loggedMin, pieces, good, scrap, scrapRate, downMin, hoursLogged, a, p, q, oee, cycleSec, hours:[{key,start,end,minutes,qty,scrap,down,good}]} */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;
  const P = { el: null, content: null, id: null, timer: null, tk: 0, prevFocus: null, offT: null };
  const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : '—');

  function ensure() {
    if (P.el) return;
    P.el = U.el(`<div class="machine-panel" role="dialog" aria-modal="true" aria-labelledby="mp-title" tabindex="-1" hidden>
      <header class="mp-head"><div class="mp-titlebox"><h2 id="mp-title"></h2><span class="mp-chip badge idle" id="mp-chip">IDLE</span></div>
        <div class="mp-actions"><button type="button" class="btn sm" data-fs>${UI.icon('maximize', 14)} Full Screen</button><button type="button" class="btn sm primary" data-close>${UI.icon('x', 14)} Close</button></div></header>
      <div class="mp-content" id="mp-content"></div></div>`);
    document.body.appendChild(P.el); P.content = $('#mp-content', P.el);
    $('[data-close]', P.el).onclick = close;
    $('[data-fs]', P.el).onclick = () => G.toggleFullscreen(P.el);
    P.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-prod]')) { const id = P.id; close(); G.Router.go('production/' + id); }
      else if (e.target.closest('[data-mp-close]')) close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !P.el.hidden && !document.fullscreenElement && !UI.hasModal()) close(); });
    document.addEventListener('fullscreenchange', syncFs);
  }
  function syncFs() { if (!P.el) return; $('.mp-actions', P.el).hidden = document.fullscreenElement === P.el; P.el.classList.toggle('is-native-fs', document.fullscreenElement === P.el); }

  /* ---------- Piezas de la vista ---------- */
  const recap = (s) => {
    const sh = s.shifts, op = s.operations;
    const it = [['Customer', s.customers && s.customers.name], ['Part Number', s.part_numbers && s.part_numbers.part_number], ['Operation', op ? `${op.operation_number} · ${op.operation_name}` : '—'], ['Lot', s.lot_number], ['Shift', sh ? `${sh.name} (${G.Shift.windowLabel(sh)})` : '—'], ['Started', U.fmtDateTime(s.started_at)], ['Operator', fullName(s.operator)], ['Supervisor', fullName(s.supervisor)]];
    return `<dl class="recap-grid">${it.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl>`;
  };
  const pill = (label, v, target) => { const st = G.statusVsTarget(v, target); return `<div class="mp-pill ${st.key}"><span class="mp-pill-label">${label}</span><b>${U.pct(v, 1)}</b><span class="badge ${st.key}">${esc(st.label)}</span><small class="muted">Target ${U.pct(target, 0)}</small></div>`; };
  const tot = (k, v) => `<div class="tot"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;

  function runningHTML(s, met, t) {
    const oee = met.oee, st = G.statusVsTarget(oee, t.oee);
    const center = `<b class="mp-oee-val">${U.pct(oee, 1)}</b><small class="muted">OEE</small>`;
    const legend = [['availability', 'Availability', met.a], ['performance', 'Performance', met.p], ['quality', 'Quality', met.q]].map(([k, l, v]) => `<li><i class="lg-dot ring-${k}"></i><span>${l}</span><b>${U.pct(v, 1)}</b></li>`).join('');
    const notes = [];
    if (!met.hasHours) notes.push('No hours have been captured yet — metrics will appear after the first Real Time hour.');
    else if (met.cycleSec == null) notes.push('No cycle time is configured for this part, operation and machine — Performance and OEE are not available.');
    const hours = (met.hours || []).length ? (met.hours || []).map((h) => `<div class="mp-hour"><b>${esc(U.fmtTime(h.start))}–${esc(U.fmtTime(h.end))}</b><span><b>${U.fmtNum(h.good)}</b> good</span><span><b>${U.fmtNum(h.scrap)}</b> scrap</span><span><b>${U.fmtNum(h.down)}</b> min down</span></div>`).join('') : '<div class="state state-empty"><span>Nothing captured yet for this session.</span></div>';
    return `${notes.map((n) => `<div class="notice warn" style="margin-bottom:14px">${UI.icon('alert', 16)}<span>${esc(n)}</span></div>`).join('')}
      <div class="mp-grid">
        <section class="panel mp-recap"><div class="panel-head"><h3>Session recap</h3></div>${recap(s)}</section>
        <section class="panel mp-oee"><div class="panel-head"><h3>Session OEE</h3><span class="live-dot">Live</span></div>
          <div class="mp-oee-body">${UI.rings({ availability: met.a, performance: met.p, quality: met.q }, { size: 280, stroke: 16, gap: 7, center })}
          <div class="mp-oee-side"><span class="badge ${st.key} mp-oee-chip">${esc(st.label)}</span><ul class="mp-legend">${legend}</ul></div></div></section>
        <section class="mp-pills">${pill('Availability', met.a, t.availability)}${pill('Performance', met.p, t.performance)}${pill('Quality', met.q, t.quality)}</section>
        <section class="mp-totals"><div class="totals-bar">${tot('Good pieces', U.fmtNum(met.good))}${tot('Scrap', U.fmtNum(met.scrap))}${tot('Scrap rate', U.pct(met.scrapRate))}${tot('Downtime', met.downMin == null ? '—' : `${U.fmtNum(met.downMin)} min`)}${tot('Hours logged', met.hoursLogged == null ? '—' : String(met.hoursLogged))}</div></section>
        <section class="panel mp-hours"><div class="panel-head"><h3>Hour by hour</h3></div><div class="mp-hours-list">${hours}</div></section>
      </div>
      <div class="btn-row mp-foot"><button class="btn brand" data-open-prod>${UI.icon('production', 16)} Open in Production</button><button class="btn" data-mp-close>Close</button></div>`;
  }
  const idleHTML = (mach) => `<div class="mp-idle panel"><div class="state state-empty">${UI.icon('production', 32)}<h3>${esc(mach.code)} has no active production session</h3><p class="muted">Start a session in Production to see live OEE, totals and hour-by-hour output here.</p><button class="btn brand" data-open-prod>${UI.icon('production', 16)} Open in Production</button></div></div>
    <div class="btn-row mp-foot"><button class="btn" data-mp-close>Close</button></div>`;

  /* ---------- Dibujo (solo reemplaza el hijo .mp-content) ---------- */
  async function draw(silent) {
    if (!P.el || P.el.hidden || !P.id) return;
    const tk = ++P.tk, scroll = P.content.scrollTop;
    if (!silent && !P.content.firstElementChild) UI.loading(P.content, 'Loading machine…');
    try {
      const m = await G.Cache.master(), mach = m.byId.machines[P.id];
      if (!mach) { UI.error(P.content, new Error('That machine could not be found.')); return; }
      const sessions = await db.select('machine_production_sessions', { where: { machine_id: P.id, status: 'RUNNING' }, embed: ['machines', 'shifts', 'customers', 'part_numbers', 'operations', 'operator', 'supervisor'] });
      const s = sessions[0], t = G.Targets.get();
      const met = s ? await G.Calc.sessionMetrics(s.id) : null;
      if (tk !== P.tk || P.el.hidden) return;
      $('#mp-title', P.el).textContent = `${mach.code} — ${mach.name}`;
      const chip = $('#mp-chip', P.el);
      const below = s && met && met.oee != null && met.oee < t.oee;
      chip.className = `mp-chip badge ${!s ? 'idle' : below ? 'watch' : 'run'}`; chip.textContent = !s ? 'IDLE' : below ? 'BELOW TARGET' : 'RUNNING';
      P.content.innerHTML = s ? runningHTML(s, met, t) : idleHTML(mach);
      P.content.scrollTop = scroll;
    } catch (e) { console.error(e); if (tk === P.tk && (!silent || !P.content.firstElementChild)) UI.error(P.content, e, () => draw()); }
  }

  function open(machineId) {
    ensure(); P.id = machineId; P.prevFocus = document.activeElement;
    P.content.innerHTML = ''; P.el.hidden = false; document.body.classList.add('mp-open'); syncFs();
    P.el.focus({ preventScroll: true });
    clearInterval(P.timer); P.timer = setInterval(() => { if (!document.hidden && G.Prefs.live()) draw(true); }, 60000);
    if (P.offT) P.offT(); P.offT = G.bus.on('targets', () => draw(true));
    return draw();
  }
  function close() {
    if (!P.el || P.el.hidden) return;
    P.tk++; clearInterval(P.timer); P.timer = null; if (P.offT) { P.offT(); P.offT = null; }
    if (document.fullscreenElement === P.el) document.exitFullscreen().catch(() => {});
    P.el.hidden = true; P.content.innerHTML = ''; P.id = null; document.body.classList.remove('mp-open');
    try { if (P.prevFocus && P.prevFocus.focus) P.prevFocus.focus(); } catch (e) { /* ignora */ }
  }
  G.MachinePanel = { open, close, isOpen: () => !!(P.el && !P.el.hidden) };
})();
