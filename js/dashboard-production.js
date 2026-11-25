/* dashboard-production.js — vista Production del Dashboard: KPIs, reactor OEE (anillos concéntricos), flujo de tiempo laminar,
   odómetro Plan vs Real, pérdidas rankeadas, evolución del OEE, Health by machine (se conserva), flota por máquina y panel lateral de análisis.
   Reemplaza a V.production de dashboard-views.js. Todo se calcula con G.Calc.summary (mismos filtros del Dashboard); al elegir una
   máquina en la tabla de flota, las secciones superiores se recalculan solo para esa máquina. */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const V = (G.DashViews = G.DashViews || {}), H = (G.DashHelpers = G.DashHelpers || {});
  const L = (es, en) => G.L(es, en), r1 = (n) => (n == null || !isFinite(n) ? '—' : (Math.round(n * 10) / 10).toLocaleString('en-US'));
  const ico = (n, s) => UI.icon(n, s || 16), cl = (v) => Math.max(0, Math.min(1, v == null || !isFinite(v) ? 0 : v));

  /** Pérdidas y etapas del flujo (minutos): Planeado → Operando (− paros no planeados) → Neto (− pérdida de velocidad) → Efectivo (− scrap) */
  function model(d) {
    const pl = d.plannedMin || 0, op = d.operatingMin || 0, p = d.p == null ? 1 : d.p, q = d.q == null ? 1 : d.q, net = op * p, eff = net * q;
    const losses = [
      { id: 'A', key: 'downtime', label: 'Unplanned downtime', min: Math.max(0, pl - op), color: 'var(--ring-a)', note: d.downByReason && d.downByReason[0] ? d.downByReason[0].label : '' },
      { id: 'P', key: 'speed', label: 'Speed loss (cycle time & micro-stops)', min: Math.max(0, op - net), color: 'var(--ring-p)', note: '' },
      { id: 'Q', key: 'scrap', label: 'Scrap (quality loss)', min: Math.max(0, net - eff), color: 'var(--ring-q)', note: d.scrapByDefect && d.scrapByDefect[0] ? d.scrapByDefect[0].label : '' },
      { id: 'A', key: 'planned', label: 'Planned downtime & setup', min: d.plannedDownMin || 0, color: 'var(--state-idle)', note: '', outside: true }
    ].sort((a, b) => b.min - a.min);
    return { pl, op, net, eff, losses, totalLoss: losses.reduce((s, x) => s + x.min, 0) };
  }

  /* ---------- Piezas ---------- */
  const kpis = (d, t, live) => {
    const gap = d.oee == null ? null : d.oee - t.oee, st = G.statusVsTarget(d.oee, t.oee), mc = live || [];
    const cnt = { run: 0, watch: 0, idle: 0 }; mc.forEach((m) => { cnt[m.state] = (cnt[m.state] || 0) + 1; });   // estado EN VIVO (sesiones RUNNING), igual que Plant Now
    const gt = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)} pts`), gear = (k, label) => `<button type="button" class="cfg-gear" data-pd-cfg="${k}" aria-label="Configure ${label}">${ico('settings', 15)}</button>`;
    return `<div class="pd-kpis">
      <div class="kpi-card">${gear('oee', 'OEE')}<div class="kpi-label"><span class="kpi-ico">${ico('production')}</span>Overall Equipment Effectiveness</div><div class="kpi-value c-${st.key}">${U.pct(d.oee, 2)}</div><span class="kpi-delta ${st.key === 'run' ? 'up' : st.key === 'idle' ? '' : 'down'}">${gap == null ? 'No data' : gt(gap) + ' vs target'}</span><div class="pd-track"><i class="s-${st.key}" style="width:${cl(d.oee) * 100}%"></i><b style="left:${cl(t.oee) * 100}%" title="Target ${U.pct(t.oee, 1)}"></b></div></div>
      <div class="kpi-card">${gear('all', 'targets')}<div class="kpi-label"><span class="kpi-ico">${ico('target')}</span>OEE target</div><div class="kpi-value">${U.pct(t.oee, 1)}</div><span class="kpi-delta">Availability ${U.pct(t.availability, 0)} · Performance ${U.pct(t.performance, 0)} · Quality ${U.pct(t.quality, 0)}</span><div class="pd-track"><i style="width:${cl(t.oee) * 100}%"></i></div></div>
      <div class="kpi-card"><div class="kpi-label"><span class="kpi-ico">${ico('layers')}</span>Machine status vs target</div><div class="kpi-value">${cnt.run + cnt.watch}<small> running · ${mc.length} machines</small></div><div class="pd-chips"><span class="badge run">${cnt.run} On track</span><span class="badge watch">${cnt.watch} Watch</span><span class="badge idle">${cnt.idle} Idle</span></div><div class="pd-track pd-multi"><i class="s-run" style="width:${mc.length ? cnt.run / mc.length * 100 : 0}%"></i><i class="s-watch" style="width:${mc.length ? cnt.watch / mc.length * 100 : 0}%"></i><i class="s-idle" style="width:${mc.length ? cnt.idle / mc.length * 100 : 0}%"></i></div></div>
      <div class="kpi-card"><div class="kpi-label"><span class="kpi-ico">${ico('check')}</span>Yield output (pieces)</div><div class="kpi-value">${U.fmtNum(d.good)}<small> / ${U.fmtNum(d.total)} ${G.t('Total').toLowerCase()}</small></div><span class="kpi-delta">FTQ ${U.pct(d.ftq, 2)} · Scrap ${U.pct(d.scrapRate, 2)} · ${U.fmtNum(d.scrap)} rejected</span><div class="pd-track"><i style="width:${cl(d.ftq) * 100}%"></i></div></div></div>`;
  };

  const reactor = (d, t, m) => {
    const R = [[138, 'a', d.a], [110, 'p', d.p], [82, 'q', d.q]], gap = d.oee == null ? null : d.oee - t.oee, st = G.statusVsTarget(d.oee, t.oee);
    const rings = R.map(([r, k, v]) => { const C = 2 * Math.PI * r; return `<circle cx="160" cy="160" r="${r}" class="ring-track" stroke-width="16" fill="none"/><circle cx="160" cy="160" r="${r}" class="ring-val ring-${k === 'a' ? 'availability' : k === 'p' ? 'performance' : 'quality'} pd-ring" data-k="${k}" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - cl(v))}" transform="rotate(-90 160 160)"/>`; }).join('');
    const card = (id, cls, label, val, sub) => `<button type="button" class="pd-legend ${cls}" data-pd="${id}"><span class="pd-lg-h"><b>${label}</b><i></i></span><strong>${val}</strong><small>${sub}</small></button>`;
    return `<section class="panel pd-reactor"><div class="panel-head"><div><h3>OEE Reactor</h3><p class="muted small">Concentric performance rings: Availability · Performance · Quality</p></div><button type="button" class="soft-link" data-pd="O">Inspect all ${ico('chevron', 13)}</button></div>
      <div class="pd-reactor-body"><svg class="pd-reactor-svg" viewBox="0 0 320 320" role="img" aria-label="OEE ${U.pct(d.oee, 1)}"><circle cx="160" cy="160" r="150" class="pd-dash" fill="none"/>${rings}
        <g transform="rotate(${(cl(t.oee) * 360).toFixed(1)} 160 160)"><line x1="160" y1="2" x2="160" y2="22" class="pd-ptr"/><polygon points="160,22 155,29 165,29" class="pd-ptr-f"/></g></svg>
        <div class="pd-core"><span>OVERALL OEE</span><b class="c-${st.key}">${U.pct(d.oee, 2)}</b><em class="badge ${st.key}">${gap == null ? '—' : (gap >= 0 ? '+' : '') + (gap * 100).toFixed(2) + ' pts vs target'}</em></div></div>
      <div class="pd-legends">${card('A', 'la', 'Availability', U.pct(d.a, 2), `Downtime: ${r1(m.losses.find((x) => x.key === 'downtime').min)} min`)}${card('P', 'lp', 'Performance', U.pct(d.p, 2), `Speed loss: ${r1(m.losses.find((x) => x.key === 'speed').min)} min`)}${card('Q', 'lq', 'Quality', U.pct(d.q, 2), `Scrap: ${U.fmtNum(d.scrap)} ${G.t('pcs')}`)}</div></section>`;
  };

  const flow = (d, m) => {
    const pl = m.pl || 1, H0 = 150, mid = 112, h = (v) => Math.max(10, H0 * v / pl), st = [[m.pl, 'Planned time', 'var(--chart-3)'], [m.op, 'Operating', 'var(--ring-a)'], [m.net, 'Net operating', 'var(--ring-p)'], [m.eff, 'Effective', 'var(--ring-q)']];
    const X = [4, 184, 364, 544], W = 132, loss = [['A', m.pl - m.op, 'Downtime'], ['P', m.op - m.net, 'Speed loss'], ['Q', m.net - m.eff, 'Scrap']];
    const blocks = st.map(([v, lb, c], i) => `<g class="pd-stage" data-pd="${['O', 'A', 'P', 'Q'][i]}"><rect x="${X[i]}" y="${mid - h(v) / 2}" width="${W}" height="${h(v)}" rx="8" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width="2"/><text x="${X[i] + W / 2}" y="${mid - 6}" class="pd-st-l" text-anchor="middle">${esc(G.t(lb)).toUpperCase()}</text><text x="${X[i] + W / 2}" y="${mid + 16}" class="pd-st-v" text-anchor="middle">${r1(v)} min</text><text x="${X[i] + W / 2}" y="${mid + 34}" class="pd-st-p" text-anchor="middle" fill="${c}">${m.pl ? (v / m.pl * 100).toFixed(1) + '%' : '—'}</text></g>`).join('');
    const links = [0, 1, 2].map((i) => { const x1 = X[i] + W, x2 = X[i + 1], a = h(st[i][0]) / 2, b = h(st[i + 1][0]) / 2, c1 = st[i][2], c2 = st[i + 1][2];
      return `<defs><linearGradient id="pdg${i}" x1="0" x2="1"><stop offset="0" stop-color="${c1}" stop-opacity=".35"/><stop offset="1" stop-color="${c2}" stop-opacity=".35"/></linearGradient></defs><path d="M${x1} ${mid - a} C${x1 + 24} ${mid - a},${x2 - 24} ${mid - b},${x2} ${mid - b} L${x2} ${mid + b} C${x2 - 24} ${mid + b},${x1 + 24} ${mid + a},${x1} ${mid + a} Z" fill="url(#pdg${i})"/><g class="pd-loss" data-pd="${loss[i][0]}"><text x="${(x1 + x2) / 2}" y="${mid - Math.max(a, b) - 8}" text-anchor="middle" class="pd-loss-t" fill="${st[i + 1][2]}">${esc(G.t(loss[i][2]))} −${r1(loss[i][1])}m</text></g>`; }).join('');
    return `<svg class="pd-flow-svg" viewBox="0 0 680 224" role="img" aria-label="Production time flow">${links}${blocks}</svg>`;
  };
  const bottleneck = (d, m) => {
    const top = m.losses.filter((x) => !x.outside)[0]; if (!top || !top.min) return '';
    const share = m.pl ? top.min / m.pl : 0, det = {
      downtime: () => (top.note ? L(`principalmente por <b>${esc(top.note)}</b>`, `mainly due to <b>${esc(top.note)}</b>`) : ''),
      speed: () => { const w = (d.byMachine || []).filter((x) => x.machine && x.oee != null).sort((a, b) => a.oee - b.oee)[0]; return w ? L(`la máquina con menor OEE es <b>${esc(w.code)}</b> (${U.pct(w.oee, 0)})`, `the lowest-OEE machine is <b>${esc(w.code)}</b> (${U.pct(w.oee, 0)})`) : ''; },
      scrap: () => (top.note ? L(`el defecto principal es <b>${esc(top.note)}</b>`, `the top defect is <b>${esc(top.note)}</b>`) : '')
    }[top.key]();
    return `<div class="pd-bottleneck"><span class="pd-bn-ico" aria-hidden="true"><span class="pd-sw-a">${G.Ramiro ? G.Ramiro.orbHTML() : ''}</span><span class="pd-sw-b">${ico('alert', 20)}</span></span><div class="pd-bn-txt"><div><b>Primary bottleneck detected</b><span class="badge stop">−${(share * 100).toFixed(1)} pts of OEE</span></div><p>${L(`<b>${G.t(top.label)}</b> es el mayor impulsor de pérdida: <b>${r1(top.min)} min</b> perdidos`, `<b>${G.t(top.label)}</b> is the main loss driver: <b>${r1(top.min)} min</b> lost`)}${det ? ' — ' + det : ''}.</p></div><button type="button" class="btn sm" data-pd="${top.id}">Inspect bottleneck ${ico('chevron', 13)}</button></div>`;
  };
  const flowPanel = (d, m) => `<section class="panel pd-flow"><div class="panel-head"><div><h3>Production time flow</h3><p class="muted small">Planned time → effective production time</p></div><span class="muted small">Overall efficiency: <b>${U.pct(d.oee, 2)}</b></span></div>${m.pl ? flow(d, m) : '<div class="state state-empty"><span>No planned time in this selection.</span></div>'}${bottleneck(d, m)}</section>`;
  H.pdModel = model; H.pdKpis = kpis; H.pdReactor = reactor; H.pdFlow = flowPanel;
})();
