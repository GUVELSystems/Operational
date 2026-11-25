/* dashboard-general.js — pestaña General: KPIs con su gráfica de tendencia + "Esto es lo que Ramiro AI ha Analizado" (respeta los filtros) */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const V = G.DashViews, H = G.DashHelpers;

  /** Observaciones automáticas a partir del resumen filtrado */
  function analyze(s) {
    const L = G.L, out = [], t = G.Targets.get(), pct = (x, d = 1) => U.pct(x, d), n = (x) => U.fmtNum(x);
    const d0 = s.scrapByDefect[0];
    if (d0 && s.scrap > 0) out.push({ tone: 'bad', icon: 'alert', title: L('Defecto con más impacto', 'Defect with the most impact'), text: L(`<b>${esc(d0.label)}</b> es el defecto que más impacto está teniendo: ${n(d0.qty)} piezas, el <b>${pct(d0.qty / s.scrap, 0)}</b> de todo el scrap del periodo.`, `<b>${esc(d0.label)}</b> is the defect with the most impact: ${n(d0.qty)} pieces, <b>${pct(d0.qty / s.scrap, 0)}</b> of all scrap in the period.`), q: L('¿Cuál es el defecto principal?', 'What is the top defect?') });
    const ms = s.byMachine.filter((m) => m.oee != null).sort((a, b) => a.oee - b.oee);
    if (ms.length > 1 || (ms.length === 1 && ms[0].oee < t.oee)) { const w = ms[0], low = w.oee < G.OEE_THRESH.stop, tone = low ? 'bad' : w.oee < t.oee ? 'warn' : 'good', best = ms[ms.length - 1]; out.push({ tone, icon: 'machines', title: L('Máquina a vigilar', 'Machine to watch'), text: L(`<b>${esc(w.code)}</b> tiene el OEE más bajo: <b>${pct(w.oee)}</b>${low ? ', un OEE muy bajo' : ''} (objetivo ${pct(t.oee, 0)}).${ms.length > 1 ? ` La mejor es ${esc(best.code)} con ${pct(best.oee)}.` : ''}`, `<b>${esc(w.code)}</b> has the lowest OEE: <b>${pct(w.oee)}</b>${low ? ', a very low OEE' : ''} (target ${pct(t.oee, 0)}).${ms.length > 1 ? ` The best is ${esc(best.code)} at ${pct(best.oee)}.` : ''}`), q: L('¿Qué máquinas están bajo objetivo?', 'Which machines are below target?') }); }
    const r0 = s.scrapRank && s.scrapRank[0];
    if (r0) out.push({ tone: 'warn', icon: 'parts', title: L('Número de parte con más scrap', 'Part number with the most scrap'), text: L(`<b>${esc(r0.part)}</b> acumula ${n(r0.scrap)} piezas de scrap (${pct(r0.scrapRate, 2)} de lo producido)${r0.defects[0] ? `; su defecto principal es ${esc(r0.defects[0].label)}` : ''}.`, `<b>${esc(r0.part)}</b> has ${n(r0.scrap)} scrap pieces (${pct(r0.scrapRate, 2)} of output)${r0.defects[0] ? `; its top defect is ${esc(r0.defects[0].label)}` : ''}.`), q: L('Dame un resumen', 'Give me a summary') });
    const dr = s.downByReason[0];
    if (dr && s.downMin > 0) out.push({ tone: 'warn', icon: 'clock', title: L('Principal causa de paro', 'Main cause of downtime'), text: L(`<b>${esc(dr.label)}</b> concentra ${n(dr.min)} min, el <b>${pct(dr.min / s.downMin, 0)}</b> del tiempo de paro.`, `<b>${esc(dr.label)}</b> accounts for ${n(dr.min)} min, <b>${pct(dr.min / s.downMin, 0)}</b> of the downtime.`), q: L('¿Cuál es el paro principal?', 'What is the top downtime?') });
    const days = s.byDay.filter((x) => x.oee != null);
    if (days.length >= 4) { const h = Math.floor(days.length / 2), avg = (a) => a.reduce((p, x) => p + x.oee, 0) / a.length, d = avg(days.slice(h)) - avg(days.slice(0, h)), pts = Math.abs(d * 100).toFixed(1); out.push({ tone: d >= 0.005 ? 'good' : d <= -0.005 ? 'bad' : 'info', icon: 'dashboard', title: L('Tendencia del OEE', 'OEE trend'), text: Math.abs(d) < 0.005 ? L('El OEE se mantiene estable entre la primera y la segunda mitad del periodo.', 'OEE is steady between the first and the second half of the period.') : L(`El OEE ${d > 0 ? 'mejora' : 'cae'} <b>${pts} pts</b> en la segunda mitad del periodo frente a la primera.`, `OEE ${d > 0 ? 'improves' : 'drops'} <b>${pts} pts</b> in the second half of the period versus the first.`), q: L('¿Cuál es el OEE de planta?', 'What is the plant OEE?') }); }
    const cp = (s.byPart || []).filter((x) => x.compliance != null).sort((a, b) => a.compliance - b.compliance)[0];
    if (cp && cp.compliance < 1) out.push({ tone: cp.compliance < 0.8 ? 'bad' : 'info', icon: 'target', title: L('Cumplimiento del plan', 'Plan compliance'), text: L(`<b>${esc(cp.part)}</b> es el número de parte que menos cumple: <b>${pct(cp.compliance, 0)}</b> de lo planeado (${n(cp.produced)} de ${n(cp.planned)} piezas).`, `<b>${esc(cp.part)}</b> is the part number with the lowest compliance: <b>${pct(cp.compliance, 0)}</b> of plan (${n(cp.produced)} of ${n(cp.planned)} pieces).`), q: L('Dame un resumen', 'Give me a summary') });
    return out;
  }  G.analyzeSummary = analyze;
  /** Estado minimizado de "Ramiro AI ha Analizado" (se recuerda en este navegador) */
  const raCollapsed = () => { try { return localStorage.getItem('guvel_ra_collapsed') === '1'; } catch (e) { return false; } };
  const raSet = (v) => { try { localStorage.setItem('guvel_ra_collapsed', v ? '1' : '0'); } catch (e) { /* sin persistencia */ } };

  const F = { total: 'Total Produced = Σ pieces produced (incl. scrap)', good: 'Good Parts = Produced − Scrap', scrap: 'Scrap Qty = Σ scrap pieces', savg: 'Scrap % = average of the scrap rate of each part number', ftq: 'FTQ = Good ÷ Produced', oee: 'OEE = Availability × Performance × Quality', ppm: 'PPM = Scrap ÷ Produced × 1,000,000', copq: 'COPQ = Poor-quality cost ÷ (Good cost + Poor-quality cost)' };
  G.KPI_FORMULAS = F;

  V.general = async (el, s) => {
    const d = s.delta || {}, c = UI.colors(), ppm = s.total ? s.scrap / s.total * 1e6 : null;
    const pp = s.prev && s.prev.total ? s.prev.scrap / s.prev.total * 1e6 : null, dppm = ppm != null && pp ? (ppm - pp) / pp : null;
    const p100 = (v) => (v == null ? null : v * 100);
    const cards = [
      ['Total Produced', 'production', U.fmtNum(s.total), { v: d.total }, true, true, { key: 'total', raw: s.total, unit: 'pcs', formula: F.total }],
      ['Good Parts', 'check', U.fmtNum(s.good), { v: d.good }, true, false, { key: 'good', raw: s.good, unit: 'pcs', formula: F.good }],
      ['Scrap Qty', 'trash', U.fmtNum(s.scrap), { v: d.scrap }, false, false, { key: 'scrap', raw: s.scrap, unit: 'pcs', formula: F.scrap }],
      ['Scrap % (avg of part numbers)', 'trash', U.pct(s.scrapAvg, 2), { v: d.scrapAvg, pts: true }, false, false, { key: 'savg', raw: p100(s.scrapAvg), unit: '%', formula: F.savg }],
      ['FTQ %', 'target', U.pct(s.ftq), { v: d.ftq, pts: true }, true, false, { key: 'ftq', raw: p100(s.ftq), unit: '%', formula: F.ftq }],
      ['OEE', 'dashboard', U.pct(s.oee), { v: d.oee, pts: true }, true, false, { key: 'oee', raw: p100(s.oee), unit: '%', formula: F.oee }],
      ['PPMs', 'alert', ppm == null ? '—' : U.fmtNum(ppm), { v: dppm }, false, false, { key: 'ppm', raw: ppm, unit: 'ppm', formula: F.ppm }],
      ['COPQ %', 'alert', U.pct(s.copq), { v: d.copq, pts: true }, false, false, { key: 'copq', raw: p100(s.copq), unit: '%', formula: F.copq }]];
    const dd = s.byDay.filter((x) => x.total > 0);   // los días sin producción se omiten (no se grafican como 0)
    const labels = dd.map((x) => H.shortDay(x.date)), ser = (f) => dd.map((x) => { const v = f(x); return v == null || !isFinite(v) ? null : v; });
    const charts = [   // key, título, unidad, color, serie, tipo
      ['total', 'Total Produced', 'pcs', c.c1, ser((x) => x.total), 'bar'], ['oee', 'OEE', '%', c.c2, ser((x) => p100(x.oee)), 'line'], ['savg', 'Scrap %', '%', c.stop, ser((x) => p100(x.scrapAvg)), 'line'],
      ['ppm', 'PPMs', 'ppm', c.watch, ser((x) => (x.total ? x.scrap / x.total * 1e6 : null)), 'line'], ['ftq', 'FTQ %', '%', c.run, ser((x) => p100(x.ftq)), 'line'], ['copq', 'COPQ %', '%', c.stop, ser((x) => p100(x.copq)), 'line']];
    const ins = analyze(s), single = s.range.from === s.range.to || dd.length < 2;
    const ringOf = (k) => {   // gráfico de anillo (solo cuando no hay tendencia: un solo día)
      const plan = s.plan || 0, pc = (v) => (v == null ? 0 : v);
      switch (k) {
        case 'total': return { labels: ['Produced', 'Remaining to plan'], data: [s.total, Math.max(0, plan - s.total)], center: `${U.pct(plan ? s.total / plan : null, 0)}<small>of plan</small>` };
        case 'savg': return { labels: ['Scrap', 'Good'], data: [pc(s.scrapAvg), 1 - pc(s.scrapAvg)], center: `${U.pct(s.scrapAvg, 2)}<small>avg scrap</small>` };
        case 'ppm': return { labels: ['Scrap', 'Good'], data: [s.scrap, s.good], center: `${ppm == null ? '—' : U.fmtNum(ppm)}<small>PPM</small>` };
        case 'ftq': return { labels: ['First time quality', 'Scrap'], data: [pc(s.ftq), 1 - pc(s.ftq)], center: `${U.pct(s.ftq)}<small>FTQ</small>` };
        case 'oee': return { labels: ['OEE', 'Loss'], data: [pc(s.oee), 1 - pc(s.oee)], center: `${U.pct(s.oee)}<small>OEE</small>` };
        default: return { labels: ['Poor quality cost', 'Good quality cost'], data: [pc(s.copq), 1 - pc(s.copq)], center: `${U.pct(s.copq)}<small>COPQ</small>` };
      }
    };
    const gear = (k) => `<button type="button" class="cfg-gear" data-chart-cfg="${k[0]}" data-label="${esc(k[1])}" data-unit="${esc(k[2])}" data-color="${esc(k[3])}" aria-label="Configure chart ${esc(k[1])}">${UI.icon('settings', 15)}</button>`;
    el.innerHTML = `<div class="kpi-grid grid cols-4">${cards.map((k) => H.kpi(k[0], k[1], k[2], k[3], k[4], k[5], k[6])).join('')}</div>
      <section class="panel ramiro-analysis${raCollapsed() ? ' collapsed' : ''}" aria-label="Ramiro AI analysis"><div class="ra-head">${G.Ramiro ? G.Ramiro.orbHTML() : ''}<div class="ra-titles"><h3>${G.L('Esto es lo que Ramiro AI ha Analizado:', 'This is what Ramiro AI has analyzed:')}</h3><p class="muted small ra-sub">${G.L(`Resúmenes importantes con los filtros que tienes aplicados (${esc(G.t(s.range.label))}).`, `Key takeaways with the filters you have applied (${esc(s.range.label)}).`)}</p><p class="ra-hint">${G.L('Expande para ver los análisis de Ramiro AI', 'Expand to see Ramiro AI\'s analysis')}</p></div><button type="button" class="ra-toggle" data-ra-toggle aria-expanded="${raCollapsed() ? 'false' : 'true'}"><span class="ra-t-min">${G.L('Minimizar', 'Minimize')}</span><span class="ra-t-exp">${G.L('Expandir', 'Expand')}</span>${UI.icon('chevron', 15)}</button></div>
        <div class="ra-body">${ins.length ? `<div class="ra-grid">${ins.map((i) => `<article class="ra-card tone-${i.tone}"><div class="ra-ico">${UI.icon(i.icon, 18)}</div><div><h4>${esc(i.title)}</h4><p>${i.text}</p><button class="btn sm ghost" data-ask="${esc(i.q)}">${G.L('Preguntarle a Ramiro', 'Ask Ramiro')}</button></div></article>`).join('')}</div>` : `<div class="state state-empty"><span>${G.L('Aún no hay suficientes datos con estos filtros para analizar.', 'Not enough data with these filters to analyze yet.')}</span></div>`}</div></section>
      <div class="section-label">${single ? 'Distribution by KPI' : 'Trend by KPI'}</div>
      <div class="grid cols-3 kpi-charts">${charts.map((k) => (single
        ? `<div class="panel chart-card"><div class="panel-head"><h3>${esc(k[1])}</h3></div><div class="donut-wrap"><div class="donut-holder" style="height:170px"><canvas id="ch-${k[0]}" role="img" aria-label="${esc(k[1])}"></canvas><div class="donut-center">${ringOf(k[0]).center}</div></div><div class="legend-list" id="ch-${k[0]}-lg"></div></div></div>`
        : `<div class="panel chart-card"><div class="panel-head"><h3>${esc(k[1])}</h3>${gear(k)}</div><div class="chart-box" style="height:250px"><canvas id="ch-${k[0]}" role="img" aria-label="${esc(k[1])}"></canvas></div></div>`)).join('')}</div>`;
    charts.forEach((k) => {
      const cv = $('#ch-' + k[0], el);
      if (single) { const r = ringOf(k[0]); H.doughnut(cv, $('#ch-' + k[0] + '-lg', el), r.labels, r.data); return; }
      const col = (G.ChartCfg.get(k[0]) || {}).color || k[3];
      const ds = k[5] === 'bar' ? { data: k[4], backgroundColor: col, borderRadius: 8, maxBarThickness: 34 } : { data: k[4], borderColor: col, backgroundColor: col + '26', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 3, pointHoverRadius: 5, spanGaps: true };
      const unit = k[2], fmt = (v) => (unit === '%' ? +Number(v).toFixed(2) + '%' : U.fmtNum(v, unit === 'ppm' ? 0 : 0));
      UI.chart(cv, G.ChartCfg.apply({ type: k[5], plugins: [G.neonDot(col, k[0])], data: { labels, datasets: [ds] }, options: { interaction: { intersect: false, mode: 'index' }, plugins: { tooltip: { callbacks: { label: (x) => ` ${x.parsed.y == null ? '—' : fmt(x.parsed.y)}` } } }, scales: { x: { type: 'category', grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: k[5] === 'bar', ticks: { callback: (v) => fmt(v) } } } } }, k[0]));
    });
    U.$$('[data-ask]', el).forEach((b) => (b.onclick = () => G.Ramiro && G.Ramiro.open(b.dataset.ask)));
    const ra = $('.ramiro-analysis', el), tg = $('[data-ra-toggle]', el);
    const flip = () => { const c = !ra.classList.contains('collapsed'); ra.classList.toggle('collapsed', c); tg.setAttribute('aria-expanded', String(!c)); raSet(c); };
    if (tg) tg.onclick = flip;
    $('.ra-head', el).addEventListener('click', (e) => { if (ra.classList.contains('collapsed') && !e.target.closest('[data-ra-toggle]')) flip(); });   // colapsado: clic en el avatar o el texto también expande
  };
})();