/* dashboard-views-b.js — vistas Quality y Downtime (Pareto, por parte / máquina / categoría) */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const V = G.DashViews, H = G.DashHelpers;

  /** Pareto: barras (valor) + línea acumulada % (eje derecho) */
  const pareto = (canvas, rows, valKey, unit) => {
    const c = UI.colors(), top = rows.slice(0, 10), total = rows.reduce((a, r) => a + r[valKey], 0) || 1; let acc = 0;
    const cum = top.map((r) => { acc += r[valKey]; return +(acc / total * 100).toFixed(1); });
    UI.chart(canvas, { data: { labels: top.map((r) => r.label), datasets: [{ type: 'bar', label: unit, data: top.map((r) => r[valKey]), backgroundColor: c.c1, borderRadius: 8, order: 2, yAxisID: 'y' }, { type: 'line', label: 'Cumulative %', data: cum, borderColor: c.c2, backgroundColor: c.c2, tension: 0.25, borderWidth: 3, pointRadius: 3, order: 1, yAxisID: 'y1' }] },
      options: { plugins: { legend: { display: true, position: 'bottom' } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0, callback(v) { const l = this.getLabelForValue(v); return l.length > 16 ? l.slice(0, 15) + '…' : l; } } }, y: { beginAtZero: true, title: { display: true, text: unit } }, y1: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { callback: (v) => v + '%' } } } } });
  };

  /* ---------- Quality: KPIs, Scrap Rank y los 4 paneles (anillos + Pareto 80/20) ---------- */
  const donutWide = (canvas, legend, center, rows, labelKey) => {   // anillo con total al centro y leyenda a todo lo ancho (top 6 + Otros)
    const pal = [UI.colors().c1, UI.colors().ink, UI.colors().c3, UI.colors().stop, UI.colors().watch, UI.colors().c2, UI.colors().idle], total = rows.reduce((a, r) => a + r.qty, 0) || 1;
    let top = rows.slice(0, 6); if (rows.length > 6) top = top.concat([{ [labelKey]: 'Others', qty: rows.slice(6).reduce((a, r) => a + r.qty, 0) }]);
    UI.chart(canvas, { type: 'doughnut', data: { labels: top.map((r) => r[labelKey]), datasets: [{ data: top.map((r) => r.qty), backgroundColor: top.map((_, i) => pal[i % pal.length]), borderColor: UI.colors().surface, borderWidth: 2 }] }, options: { cutout: '66%' } });
    legend.innerHTML = top.map((r, i) => `<div class="lw-row"><i style="background:${pal[i % pal.length]}"></i><span>${esc(r[labelKey])}</span><b>${Math.round(r.qty / total * 100)}%</b></div>`).join('');
    center.innerHTML = `${U.fmtNum(total)}<small>pieces</small>`;
  };
  const pareto80 = (canvas, rows, labelKey) => {   // barras + línea acumulada + línea punteada al 80 %
    const c = UI.colors(), top = rows.slice(0, 7), total = rows.reduce((a, r) => a + r.qty, 0) || 1; let acc = 0;
    const cum = top.map((r) => { acc += r.qty; return +(acc / total * 100).toFixed(1); }), max = Math.max.apply(null, top.map((r) => r.qty)) || 1;
    const p80 = { id: 'p80', afterDatasetsDraw(ch) { const a = ch.chartArea, y = ch.scales.y1.getPixelForValue(80), x = ch.ctx; x.save(); x.setLineDash([6, 6]); x.strokeStyle = c.stop; x.lineWidth = 1.5; x.beginPath(); x.moveTo(a.left, y); x.lineTo(a.right, y); x.stroke(); x.setLineDash([]); x.fillStyle = c.stop; x.font = '600 12px sans-serif'; x.textBaseline = 'middle'; x.fillText('80%', a.right + 8, y); x.restore(); } };
    UI.chart(canvas, { data: { labels: top.map((r) => r[labelKey]), datasets: [{ type: 'bar', data: top.map((r) => r.qty), backgroundColor: c.c1, borderRadius: 8, maxBarThickness: 76, order: 2, yAxisID: 'y' }, { type: 'line', data: cum, borderColor: c.ink, backgroundColor: c.surface, pointBackgroundColor: c.surface, pointBorderColor: c.ink, pointBorderWidth: 2.5, pointRadius: 5, borderWidth: 3, tension: 0, order: 1, yAxisID: 'y1' }] },
      plugins: [p80], options: { layout: { padding: { right: 42, top: 8 } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { callback(v) { const l = this.getLabelForValue(v); return l.length > 12 ? l.slice(0, 11) + '…' : l; } } }, y: { min: 0, max, grid: { display: false }, border: { display: false }, ticks: { callback(v) { return v === 0 || v === this.max ? U.fmtNum(v) : ''; }, autoSkip: false } }, y1: { display: false, min: 0, max: 100 } } } });
  };
  V.quality = async (el, s) => {
    const d = s.delta || {}, ask = (q) => `<button type="button" class="ai-btn" data-ask="${esc(q)}">${UI.icon('sparkles', 15)} Ask Ramiro AI about it</button>`;
    const rank = (s.scrapRank || []).map((r) => `<article class="rank-card rank-${r.rank}"><header><span class="rank-badge">#${r.rank}</span><div><b>${esc(r.part)}</b><span class="muted small">${esc(r.customer)}</span></div><div class="rank-num"><b>${U.fmtNum(r.scrap)}</b><span class="muted small">scrap pcs · ${U.pct(r.scrapRate, 2)}</span></div></header><ol class="rank-defects">${r.defects.map((x) => `<li><span class="rk">Rank ${x.rank}</span><span class="rk-name">${esc(x.label)}</span><b>${U.fmtNum(x.qty)}</b><span class="muted small">${U.pct(x.share, 0)}</span></li>`).join('')}</ol>${ask(G.L(`Dime sobre el scrap de ${r.part}`, `Tell me about the scrap of ${r.part}`))}</article>`);
    const donutCard = (title, id) => `<div class="panel chart-card"><div class="panel-head"><h3>${title}</h3></div><div class="donut-wide"><div class="donut-holder"><canvas id="${id}" role="img" aria-label="${title}"></canvas><div class="donut-center" id="${id}-c"></div></div><div class="legend-wide" id="${id}-l"></div></div></div>`;
    const parCard = (title, id) => `<div class="panel chart-card"><div class="pareto-sub">80 / 20</div><div class="panel-head"><h3>${title}</h3></div><div class="chart-box" style="height:290px"><canvas id="${id}" role="img" aria-label="${title}"></canvas></div></div>`;
    el.innerHTML = `<div class="kpi-grid grid cols-4">${[H.kpi('FTQ %', 'target', U.pct(s.ftq), { v: d.ftq, pts: true }, true, true, { key: 'ftq', raw: s.ftq == null ? null : s.ftq * 100, unit: '%', formula: 'FTQ = Good ÷ Produced' }), H.kpi('Scrap rate', 'trash', U.pct(s.scrapRate), null, false, false, { key: 'scraprate', raw: s.scrapRate == null ? null : s.scrapRate * 100, unit: '%', formula: 'Scrap rate = Scrap ÷ Produced' }), H.kpi('COPQ %', 'alert', U.pct(s.copq), { v: d.copq, pts: true }, false, false, { key: 'copq', raw: s.copq == null ? null : s.copq * 100, unit: '%', formula: 'COPQ = Poor-quality cost ÷ (Good cost + Poor-quality cost)' }), H.kpi('Scrap Qty', 'trash', U.fmtNum(s.scrap), { v: d.scrap }, false, false, { key: 'scrap', raw: s.scrap, unit: 'pcs', formula: 'Scrap Qty = Σ scrap pieces' })].join('')}</div>
      <section class="panel scrap-rank" style="margin-top:16px"><div class="panel-head"><h3>Scrap Rank</h3><span class="muted small">3 part numbers with the most scrap · top 3 defects each</span></div>${rank.length ? `<div class="rank-grid">${rank.join('')}</div>` : '<div class="state state-empty"><span>No scrap recorded in this period 🎉</span></div>'}</section>
      ${s.scrap > 0 ? `<div class="grid cols-2" style="margin-top:16px">${donutCard('Scrap by defect', 'q-d1')}${donutCard('Scrap by Part Number', 'q-d2')}${parCard('Pareto by defect', 'q-p1')}${parCard('Pareto by Part Number', 'q-p2')}</div>` : ''}`;
    U.$$('[data-ask]', el).forEach((b) => (b.onclick = () => G.Ramiro && G.Ramiro.open(b.dataset.ask)));
    if (!s.scrap) return;
    const dm = new Map(); s.scrapByDefect.forEach((x) => dm.set(x.label, (dm.get(x.label) || 0) + x.qty));   // un mismo defecto en varias partes se suma por nombre
    const defs = Array.from(dm.entries()).map(([label, qty]) => ({ label, qty })).sort((a, b) => b.qty - a.qty), parts = s.scrapByPart.map((x) => ({ label: x.label, qty: x.qty }));
    donutWide($('#q-d1', el), $('#q-d1-l', el), $('#q-d1-c', el), defs, 'label'); donutWide($('#q-d2', el), $('#q-d2-l', el), $('#q-d2-c', el), parts, 'label');
    pareto80($('#q-p1', el), defs, 'label'); pareto80($('#q-p2', el), parts, 'label');
  };
  V.downtime = async (el, s) => {
    const d = s.delta || {}, c = UI.colors(), pl = s.downPlanned || 0, un = s.downUnplanned || 0;
    el.innerHTML = `<div class="kpi-grid grid cols-4">${[H.kpi('Total Downtime', 'clock', `${U.fmtNum(s.downMin)} <small>min</small>`, { v: d.downMin }, false, true, { key: 'downtime', raw: s.downMin, unit: 'min', formula: 'Total Downtime = Σ downtime minutes (planned + unplanned)' }), H.kpi('Unplanned', 'alert', `${U.fmtNum(un)} <small>min</small>`, null, false, false, { key: 'unplanned', raw: un, unit: 'min', formula: 'Unplanned = Σ minutes of unplanned downtime events' }), H.kpi('Planned', 'check', `${U.fmtNum(pl)} <small>min</small>`, null, true, false, { key: 'planned', raw: pl, unit: 'min', formula: 'Planned = Σ minutes of planned downtime events' }), H.kpi('Availability', 'dashboard', U.pct(s.a), null, true, false, { key: 'availability', raw: s.a == null ? null : s.a * 100, unit: '%', formula: 'Availability = Operating time ÷ Planned time' })].join('')}</div>
      <div class="grid cols-2" style="margin-top:16px"><div class="panel chart-card"><div class="panel-head"><h3>Planned vs Unplanned</h3></div><div class="donut-wrap"><div class="chart-box" style="height:220px"><canvas id="ch-pu" role="img" aria-label="Planned vs Unplanned"></canvas></div><div class="legend-list" id="lg-pu"></div></div></div>
      ${H.chartCard('Downtime by machine', 'ch-dm', 260)}${H.chartCard('Downtime Pareto by reason', 'ch-dr', 320, 'span-2')}
      <div class="panel chart-card span-2"><div class="panel-head"><h3>Downtime by category</h3></div><div class="donut-wrap"><div class="chart-box" style="height:220px"><canvas id="ch-dc" role="img" aria-label="Downtime by category"></canvas></div><div class="legend-list" id="lg-dc"></div></div></div></div>`;
    if (!s.downMin) { U.$$('.chart-card', el).forEach((x) => { x.querySelector('.chart-box,.donut-wrap').innerHTML = '<div class="state state-empty"><span>No downtime recorded in this period 🎉</span></div>'; }); return; }
    H.doughnut($('#ch-pu', el), $('#lg-pu', el), ['Unplanned', 'Planned'], [un, pl]);
    H.hbar($('#ch-dm', el), s.downByMachine.map((x) => x.label), s.downByMachine.map((x) => x.min), c.c2, (v) => U.fmtNum(v) + ' ' + G.t('min'));
    pareto($('#ch-dr', el), s.downByReason, 'min', 'Minutes');
    H.doughnut($('#ch-dc', el), $('#lg-dc', el), s.downByCategory.map((x) => x.label), s.downByCategory.map((x) => x.min));
  };
})();
