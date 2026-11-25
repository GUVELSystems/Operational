/* dashboard-production-b.js — odómetro Plan vs Real, pérdidas, evolución OEE, flota, panel lateral y V.production (ver dashboard-production.js) */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const V = (G.DashViews = G.DashViews || {}), H = (G.DashHelpers = G.DashHelpers || {});
  const L = (es, en) => G.L(es, en), r1 = (n) => (n == null || !isFinite(n) ? '—' : (Math.round(n * 10) / 10).toLocaleString('en-US'));
  const ico = (n, s) => UI.icon(n, s || 16), cl = (v) => Math.max(0, Math.min(1, v == null || !isFinite(v) ? 0 : v));

  /* ---------- Odómetro (tambores) ---------- */
  const odometer = (d) => {
    const plan = Math.round(d.plan || 0), ach = plan > 0 ? d.total / plan : null, n = Math.max(4, String(Math.max(plan, d.total)).length), s = String(d.total).padStart(n, '0');
    const varp = d.total - plan, rate = d.operatingMin > 0 ? d.total / (d.operatingMin / 60) : null, trate = d.plannedMin > 0 ? plan / (d.plannedMin / 60) : null, st = G.statusVsTarget(ach, 1);
    return `<section class="panel pd-odo"><div class="panel-head"><h3>Plan vs Actual</h3><button type="button" class="soft-link" data-pd="PLAN">Detail ${ico('chevron', 13)}</button></div>
      <div class="pd-odo-lab">Produced pieces</div><div class="pd-drums" data-val="${d.total}" aria-label="${d.total}">${s.split('').map((c, i) => `<span class="pd-drum${i === n - 1 ? ' last' : ''}">${c}</span>`).join('')}<small>${G.t('pcs').toUpperCase()}</small></div>
      <div class="pd-odo-row"><span>Planned target <b>${U.fmtNum(plan)} ${G.t('pcs')}</b></span><span>Achievement <b class="c-${st.key}">${U.pct(ach, 1)}</b></span></div>
      <div class="pd-vern"><div class="pd-vern-h"><span>Production pace</span><span>Variance <b class="${varp >= 0 ? 'c-run' : 'c-stop'}">${varp >= 0 ? '+' : ''}${U.fmtNum(varp)} ${G.t('pcs')}</b></span></div><div class="pd-track pd-thick"><i class="s-${st.key}" style="width:${cl(ach) * 100}%"></i><b style="left:100%"></b></div><div class="pd-vern-f"><span>0</span><span>${U.fmtNum(plan)}</span></div></div>
      <div class="pd-odo-foot"><span>Actual run rate <b>${r1(rate)} ${G.t('pcs')}/h</b></span><span>Target rate <b>${r1(trate)} ${G.t('pcs')}/h</b></span></div></section>`;
  };
  const countUp = (el) => {
    const drums = $('.pd-drums', el); if (!drums || !G.Prefs.motion()) return;
    const val = Number(drums.dataset.val) || 0, cells = Array.from(drums.querySelectorAll('.pd-drum')), n = cells.length, t0 = performance.now(), D = 1100;
    const step = (t) => { if (!drums.isConnected) return; const k = Math.min(1, (t - t0) / D), v = Math.round(val * (1 - Math.pow(1 - k, 3))), s = String(v).padStart(n, '0'); cells.forEach((c, i) => (c.textContent = s[i])); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  /* ---------- Pérdidas rankeadas ---------- */
  const lossPanel = (d, m) => `<section class="panel pd-loss-p"><div class="panel-head"><h3>Production loss intelligence</h3><span class="muted small">Ranked impact</span></div><div class="pd-losses">${m.losses.map((x, i) => `<button type="button" class="pd-loss-row" data-pd="${x.id}"><span class="pd-lr-h"><b>${i + 1}. ${esc(G.t(x.label))}</b><span style="color:${x.color}">${r1(x.min)} min (${m.totalLoss ? (x.min / m.totalLoss * 100).toFixed(1) : '0.0'}%)</span></span><span class="pd-track pd-thin"><i style="width:${m.totalLoss ? x.min / m.totalLoss * 100 : 0}%;background:${x.color}"></i></span>${x.note ? `<small class="muted">${esc(x.note)}</small>` : x.outside ? `<small class="muted">${L('No afecta el OEE', 'Does not affect OEE')}</small>` : ''}</button>`).join('')}</div>
      <div class="pd-odo-foot"><span>Total lost production equivalent <b class="c-stop">${r1(m.totalLoss)} min</b></span><button type="button" class="soft-link" data-pd="O">Root causes ${ico('chevron', 13)}</button></div></section>`;

  /* ---------- Evolución del OEE ---------- */
  const trendPanel = (d, t) => {
    const pts = (d.byDay || []).filter((x) => x.oee != null).slice(-8);
    const avg = pts.length ? pts.reduce((s, x) => s + x.oee, 0) / pts.length : null, last = pts[pts.length - 1];
    return `<section class="panel pd-trend"><div class="panel-head"><h3>OEE evolution</h3><span class="muted small">Target: ${U.pct(t.oee, 1)}</span></div>${pts.length > 1 ? '<div class="chart-box" style="height:190px"><canvas id="pd-trend" role="img" aria-label="OEE evolution"></canvas></div>' : '<div class="state state-empty"><span>The trend needs at least two days with data. Pick a wider period.</span></div>'}
      <div class="pd-odo-foot"><span>Average <b>${U.pct(avg, 2)}</b></span><span class="pd-cur">Latest: <b>${last ? H.shortDay(last.date) + ' · ' + U.pct(last.oee, 2) : '—'}</b></span></div></section>`;
  };
  const drawTrend = (el, d, t) => {
    const cv = $('#pd-trend', el); if (!cv) return; const pts = (d.byDay || []).filter((x) => x.oee != null).slice(-8), c = UI.colors();
    UI.chart(cv, { type: 'line', data: { labels: pts.map((x) => H.shortDay(x.date)), datasets: [
      { label: 'OEE', data: pts.map((x) => +(x.oee * 100).toFixed(2)), borderColor: c.c1, backgroundColor: c.c1 + '26', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4, pointBackgroundColor: pts.map((x) => (x.oee >= t.oee ? c.run : c.c1)), pointHoverRadius: 6 },
      { label: 'Target', data: pts.map(() => +(t.oee * 100).toFixed(2)), borderColor: c.stop, borderDash: [6, 5], borderWidth: 1.6, pointRadius: 0, fill: false }] },
      options: { interaction: { intersect: false, mode: 'index' }, plugins: { tooltip: { callbacks: { label: (x) => ` ${x.dataset.label === 'OEE' ? 'OEE' : G.t('Target')}: ${x.parsed.y.toFixed(2)}%` } } }, scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => v + '%' }, suggestedMax: Math.max(100 * t.oee + 3, ...pts.map((x) => x.oee * 100 + 2)) } } } });
  };

  /* ---------- Flota por máquina ---------- */
  const fleet = (s, t, sel) => {
    const rows = (s.byMachine || []).filter((m) => m.machine).map((m) => { const q = m.total ? m.good / m.total : null, p = m.oee != null && m.a && q ? m.oee / (m.a * q) : null; return Object.assign({ q, p }, m); });
    const bar = (v, k) => `<div class="pd-mini"><span>${U.pct(v, 1)}</span><i><b class="s-${k}" style="width:${cl(v) * 100}%"></b></i></div>`;
    return `<section class="panel pd-fleet"><div class="panel-head"><div><h3>Machine fleet</h3><p class="muted small">Click a row to filter the sections above to that machine.</p></div><span class="muted small">${rows.length} ${G.t('machines')}</span></div>${UI.table([
      { label: 'Machine', render: (r) => `<b>${esc(r.code)}</b> <span class="muted small">${esc(r.machine.name)}</span>` },
      { label: 'Status', render: (r) => { const st = G.statusVsTarget(r.oee, t.oee); return `<span class="badge ${st.key}">${esc(G.t(st.label))}</span>`; } },
      { label: 'OEE', align: 'right', render: (r) => `<b class="c-${G.statusVsTarget(r.oee, t.oee).key}">${U.pct(r.oee, 2)}</b>` },
      { label: 'Availability', render: (r) => bar(r.a, 'a') }, { label: 'Performance', render: (r) => bar(r.p, 'p') }, { label: 'Quality', render: (r) => bar(r.q, 'q') },
      { label: 'Produced', align: 'right', render: (r) => U.fmtNum(r.total) }, { label: 'Rejected', align: 'right', render: (r) => `<span class="${r.scrap > 0 ? 'c-stop' : 'muted'}">${U.fmtNum(r.scrap)}</span>` },
      { label: 'Downtime (min)', align: 'right', render: (r) => U.fmtNum(r.downMin) }], rows, { empty: 'No machines with data in this period.', rowAttrs: (r) => `class="pd-frow${sel && r.machine.id === sel ? ' sel' : ''}" data-mid="${esc(r.machine.id)}" tabindex="0"` })}</section>`;
  };

  /* ---------- Panel lateral de análisis ---------- */
  const listRows = (items, unit, total) => (items.length ? items.slice(0, 6).map((x) => `<div class="pd-d-row"><span>${esc(x.label)}</span><b>${U.fmtNum(x[unit === 'min' ? 'min' : 'qty'])} ${unit === 'min' ? 'min' : G.t('pcs')}</b><i><b style="width:${total ? x[unit === 'min' ? 'min' : 'qty'] / total * 100 : 0}%"></b></i></div>`).join('') : `<p class="muted">${L('Sin registros en este periodo.', 'No records in this period.')}</p>`);
  const drawerHTML = (cat, d, t, m) => {
    const stat = (lab, val, cls) => `<div class="pd-d-stat"><span>${lab}</span><b class="${cls || ''}">${val}</b></div>`;
    if (cat === 'A') return { badge: 'Availability drill-down', title: 'Downtime & stop events', q: L('¿Qué está causando los paros?', 'What is causing the downtime?'), html: `<div class="pd-d-stats">${stat('Unplanned downtime', r1(m.losses.find((x) => x.key === 'downtime').min) + ' min', 'c-stop')}${stat('Availability', U.pct(d.a, 2))}${stat('Planned downtime', r1(d.plannedDownMin) + ' min')}</div><h4>Downtime by reason</h4>${listRows(d.downByReason || [], 'min', d.downMin)}<h4>Downtime by machine</h4>${listRows(d.downByMachine || [], 'min', d.downMin)}` };
    if (cat === 'P') { const ms = (d.byMachine || []).filter((x) => x.machine && x.oee != null && x.a && x.total).map((x) => { const q = x.good / x.total; return { label: x.code, p: x.oee / (x.a * q) }; }).sort((a, b) => a.p - b.p);
      return { badge: 'Performance drill-down', title: 'Cycle-time & speed loss', q: L('¿Dónde estamos perdiendo velocidad?', 'Where are we losing speed?'), html: `<div class="pd-d-stats">${stat('Speed loss', r1(m.losses.find((x) => x.key === 'speed').min) + ' min', 'c-stop')}${stat('Performance', U.pct(d.p, 2))}${stat('Target', U.pct(t.performance, 0))}</div><h4>Performance by machine (lowest first)</h4>${ms.length ? ms.map((x) => `<div class="pd-d-row"><span>${esc(x.label)}</span><b>${U.pct(x.p, 1)}</b><i><b style="width:${cl(x.p) * 100}%"></b></i></div>`).join('') : `<p class="muted">${L('Sin datos.', 'No data.')}</p>`}<p class="muted small">${L('Pérdida de velocidad = tiempo operando − piezas × ciclo ideal.', 'Speed loss = operating time − pieces × ideal cycle.')}</p>` }; }
    if (cat === 'Q') return { badge: 'Quality & scrap drill-down', title: 'Rejections & defect breakdown', q: L('¿Cuáles son los defectos principales?', 'What are the top defects?'), html: `<div class="pd-d-stats">${stat('First time quality', U.pct(d.ftq, 2))}${stat('Rejected', U.fmtNum(d.scrap) + ' ' + G.t('pcs'), 'c-stop')}${stat('Good parts', U.fmtNum(d.good))}</div><h4>Scrap by defect</h4>${listRows(d.scrapByDefect || [], 'qty', d.scrap)}<h4>Scrap by part number</h4>${listRows(d.scrapByPart || [], 'qty', d.scrap)}` };
    if (cat === 'PLAN') { const rows = d.byPart || [], tp = U.sum(rows, (r) => r.planned), tq = U.sum(rows, (r) => r.produced), comp = (v) => `<span class="badge ${G.statusVsTarget(v, 1).key}">${U.pct(v, 1)}</span>`;
      return { badge: 'Plan vs actual', title: 'Production Real vs Plan', q: L('¿Cómo vamos contra el plan?', 'How are we doing against the plan?'), html: `<p class="muted small">${L('Cantidad planeada = tiempo planeado ÷ tiempo de ciclo.', 'Planned quantity = planned time ÷ cycle time.')}</p>${UI.table([{ label: 'Customer', key: 'customer' }, { label: 'Part Number', render: (r) => `<b>${esc(r.part)}</b>` }, { label: 'Planned Quantity', align: 'right', render: (r) => U.fmtNum(r.planned) }, { label: 'Produced Quantity', align: 'right', render: (r) => U.fmtNum(r.produced) }, { label: 'Compliance %', align: 'right', render: (r) => comp(r.compliance) }], rows.concat(rows.length > 1 ? [{ customer: 'Total', part: '', planned: tp, produced: tq, compliance: tp > 0 ? tq / tp : null, total: true }] : []), { empty: 'No production in this period.', cls: 'plan-real', rowAttrs: (r) => (r.total ? 'class="row-total"' : '') })}` }; }
    return { badge: 'Overall inspection', title: 'Plant OEE master telemetry', q: L('Resúmeme el OEE', 'Summarize the OEE'), html: `<div class="pd-d-audit"><b>Formula audit</b><span>OEE = Availability (${U.pct(d.a, 2)}) × Performance (${U.pct(d.p, 2)}) × Quality (${U.pct(d.q, 2)}) = <b>${U.pct(d.oee, 2)}</b></span></div><div class="pd-d-stats">${stat('Planned time', r1(m.pl) + ' min')}${stat('Operating time', r1(m.op) + ' min')}${stat('Effective time', r1(m.eff) + ' min')}</div><h4>Loss ranking</h4>${m.losses.map((x) => `<div class="pd-d-row"><span>${esc(G.t(x.label))}</span><b>${r1(x.min)} min</b><i><b style="width:${m.totalLoss ? x.min / m.totalLoss * 100 : 0}%;background:${x.color}"></b></i></div>`).join('')}` };
  };
  H.pdDrawer = (host, cat, d, t, m) => {
    const c = drawerHTML(cat, d, t, m); host.querySelector('.pd-drawer')?.remove();
    const el = U.el(`<div class="pd-drawer"><div class="pd-d-back" data-x></div><aside class="pd-d-panel" role="dialog" aria-label="${esc(G.t(c.title))}"><header><div><span class="badge info">${esc(G.t(c.badge))}</span><h3>${esc(G.t(c.title))}</h3></div><button type="button" class="icon-btn" data-x aria-label="Close">${ico('x')}</button></header><div class="pd-d-body">${c.html}</div><footer><button type="button" class="ai-btn" data-ask="${esc(c.q)}">${ico('sparkles', 15)} Ask Ramiro AI about it</button><button type="button" class="btn ghost" data-x>Close inspection</button></footer></aside></div>`);
    host.appendChild(el); requestAnimationFrame(() => el.classList.add('open'));
    const close = () => { el.classList.remove('open'); document.removeEventListener('keydown', onKey, true); setTimeout(() => el.remove(), 260); }, onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    U.$$('[data-x]', el).forEach((b) => (b.onclick = close)); const ask = $('[data-ask]', el); ask.onclick = () => { close(); G.Ramiro && G.Ramiro.open(ask.dataset.ask); };
  };

  /* ---------- Vista ---------- */
  /** Engrane de objetivos: solo OEE ('oee') o OEE + Availability + Performance + Quality ('all'). Se guardan en G.Targets (los usa Plant Now) */
  H.openTargetsCfg = (mode, onSave) => {
    const t = G.Targets.get(), rows = (mode === 'oee' ? [['oee', 'OEE target %']] : [['oee', 'OEE target %'], ['availability', 'Availability target %'], ['performance', 'Performance target %'], ['quality', 'Quality target %']]);
    const m = UI.modal({ title: mode === 'oee' ? 'Overall Equipment Effectiveness' : 'OEE target', subtitle: 'KPI CONFIGURATION', size: 'md', className: 'cfg-modal',
      body: `<div class="cfg-formula"><b>Targets</b><span>${L('Se usan en la barra, los colores de estado y Plant Now.', 'Used by the bar, the status colors and Plant Now.')}</span></div><div class="cfg-row3">${rows.map(([k, lab]) => `<div class="field"><label for="tg-${k}">${lab}</label><input id="tg-${k}" type="number" min="1" max="100" step="0.1" value="${+(t[k] * 100).toFixed(2)}"></div>`).join('')}</div><div class="form-error" id="tg-err" hidden></div>`,
      footer: '<button class="btn" data-reset style="margin-right:auto">Reset</button><button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>Save</button>' });
    $('[data-reset]', m.root).onclick = () => { G.Targets.reset(); m.close(); onSave(); };
    $('[data-save]', m.root).onclick = () => {
      const nt = Object.assign({}, G.Targets.get()), err = $('#tg-err', m.root);
      for (const [k] of rows) { const v = Number($('#tg-' + k, m.root).value); if (!isFinite(v) || v < 1 || v > 100) { err.hidden = false; err.textContent = L('Cada objetivo debe estar entre 1 y 100.', 'Each target must be between 1 and 100.'); return; } nt[k] = v / 100; }
      G.Targets.set(nt); m.close(); onSave();
    };
  };

  V.production = async (el, s) => {
    let t = G.Targets.get(), live = [];
    const host = el.closest('.dash') || document.body, st = { sel: '', sub: null };
    try { live = await G.Calc.liveMachines(); } catch (e) { live = []; }
    const scope = () => (st.sel && st.sub ? st.sub : s), mod = () => H.pdModel(scope());
    el.innerHTML = `<div id="pd-scope" class="pd-scope" hidden></div><div id="pd-top"></div>${H.healthHTML(s)}<div id="pd-fleet"></div>`;
    const top = $('#pd-top', el), bind = (root) => U.$$('[data-pd]', root).forEach((b) => (b.onclick = () => H.pdDrawer(host, b.dataset.pd, scope(), t, mod())));
    const drawTop = () => {
      const d = scope(), m = mod(); UI.destroyCharts(top);
      top.innerHTML = `${H.pdKpis(d, t, live)}<div class="pd-main">${H.pdReactor(d, t, m)}${H.pdFlow(d, m)}</div><div class="pd-row3">${odometer(d)}${lossPanel(d, m)}${trendPanel(d, t)}</div>`;
      bind(top); drawTrend(top, d, t); countUp(top);
      U.$$('[data-pd-cfg]', top).forEach((b) => (b.onclick = () => H.openTargetsCfg(b.dataset.pdCfg, async () => { t = G.Targets.get(); try { live = await G.Calc.liveMachines(); } catch (e) { /* mantiene */ } drawTop(); drawFleet(); })));
      const sc = $('#pd-scope', el), mach = st.sel && (s.byMachine || []).find((x) => x.machine && x.machine.id === st.sel);
      sc.hidden = !mach; if (mach) sc.innerHTML = `<span>${ico('filter', 14)} Scope: <b>${esc(mach.code)} — ${esc(mach.machine.name)}</b></span><button type="button" class="btn sm" data-reset>${ico('x', 13)} Reset</button>`;
      const rs = $('[data-reset]', sc); if (rs) rs.onclick = () => pick('');
    };
    const drawFleet = () => { const f = $('#pd-fleet', el); f.innerHTML = fleet(s, t, st.sel); U.$$('.pd-frow', f).forEach((r) => { const go = () => pick(r.dataset.mid === st.sel ? '' : r.dataset.mid); r.onclick = go; r.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; }); };
    async function pick(id) {
      st.sel = id; st.sub = null;
      if (id) { try { st.sub = await G.Calc.summary(Object.assign({}, G.dashFilters(), { machineId: id })); } catch (e) { st.sel = ''; } }
      drawTop(); drawFleet(); if (id) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    drawTop(); drawFleet();
    U.$$('[data-ask]', el).forEach((b) => (b.onclick = () => G.Ramiro && G.Ramiro.open(b.dataset.ask)));
    const ex = $('[data-expand-health]', el); if (ex) ex.onclick = () => H.expandHealth(s);
  };
})();
