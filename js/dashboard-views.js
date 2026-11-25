/* dashboard-views.js — helpers de gráficas y vistas General y Production (anillos concéntricos + medidor de aguja) */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const V = (G.DashViews = G.DashViews || {});
  const H = (G.DashHelpers = {});

  H.palette = () => { const c = UI.colors(); return [c.c1, c.c2, c.c3, c.run, c.watch, c.stop, c.idle]; };
  H.chartCard = (title, id, h = 260, cls = '') => `<div class="panel chart-card ${cls}"><div class="panel-head"><h3>${esc(title)}</h3></div><div class="chart-box" style="height:${h}px"><canvas id="${id}" role="img" aria-label="${esc(title)}"></canvas></div></div>`;
  H.shortDay = (d) => U.fmtShortDate(d);
  /** Gráfica de tendencia por día de un KPI (periodos de varios días) */
  H.trend = (canvas, labels, data, color, unit) => UI.chart(canvas, { type: 'line', data: { labels, datasets: [{ data, borderColor: color, backgroundColor: color + '26', fill: true, tension: 0.35, borderWidth: 3, pointRadius: 2, pointHoverRadius: 5, spanGaps: true }] }, options: { interaction: { intersect: false, mode: 'index' }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.parsed.y == null ? '—' : Number(c.parsed.y).toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit || ''}` } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { beginAtZero: false, ticks: { callback: (v) => (unit ? +Number(v).toFixed(2) + unit : U.fmtNum(v)) } } } } });
  /** Salud por máquina: tarjetas con OEE, disponibilidad, minutos de paro y scrap */
  H.healthHTML = (s) => {
    const rows = (s.byMachine || []).filter((m) => m.machine), fam = (c) => { const f = String(c).split('-')[0]; return f === 'CNC' ? 'CNC' : f.charAt(0); };
    if (!rows.length) return '';
    const ring = (v) => { const r = 24, C = 2 * Math.PI * r, p = v == null ? 0 : Math.max(0, Math.min(1, v)); return `<span class="mh-ring c-${G.oeeColorKey(v)}"><svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true"><circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="6"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 28 28)"/></svg><b>${v == null ? '—' : Math.round(v * 100) + '%'}</b></span>`; };
    const card = (m, i) => `<article class="mh-card"><div class="mh-banner g${i % 6}">${UI.icon('production', 30)}<span class="mh-badge">${esc(fam(m.code))}</span></div>
      <div class="mh-main">${ring(m.oee)}<div class="mh-name"><b>${esc(m.machine.name)} · ${esc(m.code)}</b><span class="muted small">${esc([m.process, m.parts && m.parts.length ? 'NP ' + m.parts.join(', ') : ''].filter(Boolean).join(' · '))}</span></div></div>
      <div class="mh-stats"><div><b>${U.pct(m.a, 0)}</b><span>Avail.</span></div><div><b>${U.fmtNum(m.downMin)}</b><span>Downtime min</span></div><div><b>${U.pct(m.scrapRate, 2)}</b><span>Scrap</span></div></div>
      <button type="button" class="ai-btn" data-ask="${esc(G.L(`¿Cómo va ${m.code}?`, `How is ${m.code} doing?`))}">${UI.icon('sparkles', 15)} Ask Ramiro AI about it</button></article>`;
    H.healthCards = () => rows.map(card).join('');
    return `<div class="section-label section-row"><span>Health by machine</span><button type="button" class="soft-link" data-expand-health>${UI.icon('maximize', 13)} Expand Information</button></div><div class="mh-grid">${H.healthCards()}</div>`;
  };
  /** Ventana grande (≈ 3/4 de la pantalla) con TODAS las máquinas ajustadas al espacio, sin scroll */
  H.expandHealth = (s) => {
    const n = (s.byMachine || []).filter((m) => m.machine).length, html = H.healthCards ? H.healthCards() : '';
    const cols = n <= 3 ? n : n <= 8 ? 4 : n <= 12 ? 4 : n <= 15 ? 5 : 6, rowsN = Math.ceil(n / cols);
    const m = UI.modal({ title: 'Health by machine', subtitle: `${s.range.label} · ${n} machines`, size: 'xl', className: 'mh-expand', body: `<div class="mh-grid-all" style="--cols:${cols};--rows:${rowsN}">${html}</div>` });
    U.$$('[data-ask]', m.root).forEach((b) => (b.onclick = () => { m.close(); G.Ramiro && G.Ramiro.open(b.dataset.ask); }));
    return m;
  };
  /** Mini gráfica de tendencia (una por KPI) */
  H.spark = (canvas, labels, data, color, unit) => UI.chart(canvas, { type: 'line', data: { labels, datasets: [{ data, borderColor: color, backgroundColor: color + '26', fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, spanGaps: true }] }, options: { interaction: { intersect: false, mode: 'index' }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.parsed.y == null ? '—' : Number(c.parsed.y).toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit || ''}` } } }, scales: { x: { display: false }, y: { display: false, beginAtZero: false } }, layout: { padding: { top: 4, bottom: 0 } } } });
  H.kpi = (label, icon, value, delta, goodUp, feature, meta) => {
    const ev = meta && meta.key ? G.KpiCfg.evaluate(meta.key, meta.raw) : { state: 'none' };
    const gear = meta && meta.key ? `<button type="button" class="cfg-gear" data-kpi-cfg="${esc(meta.key)}" data-label="${esc(label)}" data-formula="${esc(meta.formula || '')}" data-unit="${esc(meta.unit || '')}" aria-label="Configure ${esc(label)}">${UI.icon('settings', 15)}</button>` : '';
    const flag = '';   // la condición se muestra coloreando el número (sin contorno ni etiqueta)
    const sparkId = null;
    let dh = '<span class="kpi-delta">No previous data</span>';
    if (delta && delta.v != null && isFinite(delta.v)) {
      const v = delta.pts ? delta.v * 100 : delta.v * 100, up = v >= 0, good = goodUp ? up : !up, txt = `${up ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}${delta.pts ? ' pts' : '%'} vs previous period`;
      dh = `<span class="kpi-delta ${Math.abs(v) < 0.05 ? '' : good ? 'up' : 'down'}">${txt}</span>`;
    }
    return `<div class="kpi-card${feature ? ' feature' : ''}${ev.state === 'in' ? ' cfg-in' : ev.state === 'out' ? ' cfg-out' : ''}"${ev.color ? ` style="--kpi-c:${esc(ev.color)}"` : ''}>${gear}<div class="kpi-label"><span class="kpi-ico">${UI.icon(icon, 16)}</span>${esc(label)}</div><div class="kpi-value">${value}</div>${dh}${flag}${sparkId ? `<div class="kpi-spark"><canvas id="${sparkId}" role="img" aria-label="${esc(label)} trend"></canvas></div>` : ''}</div>`;
  };
  H.hbar = (canvas, labels, data, color, fmt) => UI.chart(canvas, { type: 'bar', data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 8, maxBarThickness: 22 }] }, options: { indexAxis: 'y', plugins: { tooltip: { callbacks: { label: (c) => ` ${fmt ? fmt(c.parsed.x) : c.parsed.x}` } } }, scales: { x: { beginAtZero: true, grid: { display: true } }, y: { grid: { display: false } } } } });
  H.doughnut = (canvas, legendEl, labels, data) => {
    const pal = H.palette(), total = data.reduce((a, b) => a + b, 0) || 1;
    UI.chart(canvas, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: labels.map((_, i) => pal[i % pal.length]), borderWidth: 0, hoverOffset: 6 }] }, options: { cutout: '68%' } });
    if (legendEl) legendEl.innerHTML = labels.map((l, i) => `<div class="legend-row"><i style="background:${pal[i % pal.length]}"></i><span>${esc(l)}</span><b>${(data[i] / total * 100).toFixed(1)}%</b></div>`).join('');
  };

  /* ---------- Medidor de aguja (Plan vs Actual) ---------- */
  const pt = (th, r) => [100 + r * Math.sin(th * Math.PI / 180), 100 - r * Math.cos(th * Math.PI / 180)];
  const arc = (a, b, r) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r); return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`; };
  H.needleGauge = (host, value) => {
    const v = value == null || !isFinite(value) ? 0 : Math.max(0, Math.min(1, value)), ang = (f) => -90 + 180 * f, th = G.OEE_THRESH;
    const segs = [[0, th.stop, 'var(--state-stop)'], [th.stop, th.run, 'var(--state-watch)'], [th.run, 1, 'var(--state-run)']];
    host.innerHTML = `<svg viewBox="0 0 200 118" class="needle-gauge" role="img" aria-label="Plan vs actual ${U.pct(value, 0)}">${segs.map(([a, b, c]) => `<path d="${arc(ang(a), ang(b), 80)}" stroke="${c}" stroke-width="14" fill="none" stroke-linecap="butt"/>`).join('')}
      <g class="needle" style="transform-origin:100px 100px"><path d="M96 100 L100 28 L104 100 Z" fill="var(--ink)"/><circle cx="100" cy="100" r="7" fill="var(--ink)"/></g></svg>`;
    const n = $('.needle', host), target = ang(v);
    if (!G.Prefs.motion()) { n.style.transform = `rotate(${target}deg)`; return; }
    n.style.transform = 'rotate(-90deg)'; const t0 = performance.now(), D = 1600;
    const step = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); n.style.transform = `rotate(${-90 + (target + 90) * e}deg)`; if (k < 1 && n.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  /* ---------- Production ---------- */
  V.production = async (el, s) => {
    const key = G.oeeColorKey(s.oee), ratio = s.plan ? s.total / s.plan : null, c = UI.colors();
    const center = `<b class="ring-oee c-${key}">${U.pct(s.oee, 1)}</b><span class="muted small">OEE</span>`;
    el.innerHTML = `<div class="grid cols-2"><div class="panel"><div class="panel-head"><h3>Overall Equipment Effectiveness</h3></div><div class="ring-panel">${UI.rings({ availability: s.a, performance: s.p, quality: s.q }, { size: 250, stroke: 16, gap: 6, center })}
        <div class="ring-legend"><div><i class="dot-a"></i><span>Availability</span><b>${U.pct(s.a)}</b></div><div><i class="dot-p"></i><span>Performance</span><b>${U.pct(s.p)}</b></div><div><i class="dot-q"></i><span>Quality</span><b>${U.pct(s.q)}</b></div></div></div></div>
      <div class="panel"><div class="panel-head"><h3>Plan vs Actual</h3></div><div class="gauge-panel"><div id="gauge"></div><div class="gauge-val c-${G.oeeColorKey(ratio)}"><b>${U.pct(ratio, 0)}</b><span class="muted small">${U.fmtNum(s.total)} of ${U.fmtNum(s.plan)} planned pieces</span></div></div></div></div>
      ${H.healthHTML(s)}
      <div class="grid cols-2" style="margin-top:16px">${H.chartCard('Production by day', 'ch-day', 280)}${H.chartCard('Production by machine', 'ch-mach', 280)}</div>`;
    H.needleGauge($('#gauge', el), ratio);
    U.$$('[data-ask]', el).forEach((b) => (b.onclick = () => G.Ramiro && G.Ramiro.open(b.dataset.ask)));
    const ex = $('[data-expand-health]', el); if (ex) ex.onclick = () => H.expandHealth(s);
    UI.chart($('#ch-day', el), { type: 'bar', data: { labels: s.byDay.map((x) => H.shortDay(x.date)), datasets: [{ data: s.byDay.map((x) => x.total), backgroundColor: c.c1, borderRadius: 6 }] }, options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } } });
    /* Production Real vs Plan: plan = tiempo planificado ÷ tiempo de ciclo; cumplimiento = producido ÷ plan */
    const rows = s.byPart || [], tp = U.sum(rows, (r) => r.planned), tq = U.sum(rows, (r) => r.produced), tc = tp > 0 ? tq / tp : null;
    const comp = (v) => { const st = G.statusVsTarget(v, 1); return `<span class="badge ${st.key}">${U.pct(v, 1)}</span>`; };
    el.insertAdjacentHTML('beforeend', `<section class="panel plan-real" style="margin-top:16px"><div class="panel-head"><h3>Production Real vs Plan</h3><span class="muted small">Planned quantity = planned time ÷ cycle time</span></div>${UI.table([
      { label: 'Customer', key: 'customer' }, { label: 'Part Number', render: (r) => `<b>${esc(r.part)}</b>` },
      { label: 'Planned Quantity', align: 'right', render: (r) => U.fmtNum(r.planned) }, { label: 'Produced Quantity', align: 'right', render: (r) => U.fmtNum(r.produced) },
      { label: 'Compliance %', align: 'right', render: (r) => comp(r.compliance) }], rows.concat(rows.length > 1 ? [{ customer: 'Total', part: '', planned: tp, produced: tq, compliance: tc, total: true }] : []), { empty: 'No production in this period.', rowAttrs: (r) => (r.total ? 'class="row-total"' : '') })}</section>`);
    const bm = s.byMachine.slice().sort((a, b) => b.total - a.total); H.hbar($('#ch-mach', el), bm.map((x) => x.code), bm.map((x) => x.total), c.c2, (v) => U.fmtNum(v) + ' ' + G.t('pcs'));
  };
})();
