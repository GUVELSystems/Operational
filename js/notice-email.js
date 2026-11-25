/* notice-email.js — contenido de los reportes de Notices y su HTML de correo (tablas + estilos en línea, compatible con clientes de correo).
   Reportes: General (OEE + Scrap + FTQ + PPMs + Downtime por número de parte) · Quality (Ranks + Scrap % + FTQ + PPMs + defectos con cantidades) · Production (salud por máquina). */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, esc = U.esc;
  const C = { navy: '#0F1B2D', cyan: '#0CC0DF', bg: '#EAF2F8', card: '#FFFFFF', text: '#4A6183', ink: '#0F1B2D', line: '#E3ECF4', soft: '#F2F7FB', run: '#1FB37A', watch: '#E8A92B', stop: '#E07A6B', idle: '#8DA0B8' };
  const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const REPORTS = {
    general: { label: 'General Report', icon: 'dashboard', desc: 'OEE + Scrap + FTQ + PPMs + Downtime, by part number.' },
    quality: { label: 'Quality Report', icon: 'target', desc: 'Scrap Rank + Scrap % + FTQ + PPMs + defects with quantities.' },
    production: { label: 'Production Report', icon: 'production', desc: 'Health by machine: OEE, availability, downtime and scrap.' },
    custom: { label: 'Custom Report', icon: 'sparkles', desc: 'Pick exactly which KPIs and tables to send.' }
  };
  const PERIODS = [['yesterday', 'Yesterday'], ['lastweek', 'Previous Week'], ['month', 'This Month'], ['lastmonth', 'Previous Month']];
  const FREQ = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  /** Periodo que cubre cada frecuencia: diario → el día anterior; semanal → la semana anterior; mensual → el mes anterior */
  const periodFor = (f) => ({ daily: 'yesterday', weekly: 'lastweek', monthly: 'lastmonth' }[f] || 'yesterday');
  const when = (n) => `${FREQ[n.frequency] || ''} at ${n.send_time}${n.frequency === 'weekly' ? ' · ' + DAYS[n.weekday % 7] + 's' : n.frequency === 'monthly' ? ' · day ' + n.month_day : ''}`;
  const covers = (n) => ({ daily: "yesterday's data", weekly: "the previous week's data", monthly: "the previous month's data" }[n.frequency] || '');

  const tone = (v, t) => (v == null ? C.idle : v >= t ? C.run : t - v <= 0.1 ? C.watch : C.stop);
  const pc = (v, d = 1) => U.pct(v, d), num = (v) => U.fmtNum(v);
  const ppmOf = (s) => (s.total ? s.scrap / s.total * 1e6 : null);

  /* ---------- Datos ---------- */
  async function gather(type, period, blocks = []) {
    const s = await G.Calc.summary({ period });
    const out = { s, hasData: !!(s.total || s.downMin), range: s.range, ppm: ppmOf(s) };
    if (type === 'general' || (type === 'custom' && blocks.includes('part_table'))) {
      out.parts = [];
      for (const p of s.byPart || []) { const ps = await G.Calc.summary({ period, partNumberId: p.id }); out.parts.push({ part: p.part, customer: p.customer, oee: ps.oee, scrapRate: ps.scrapAvg, ftq: ps.ftq, ppm: ppmOf(ps), down: ps.downMin, produced: ps.total }); }
    }
    if (type === 'quality' || type === 'custom') {
      const m = new Map(); (s.scrapByDefect || []).forEach((x) => m.set(x.label, (m.get(x.label) || 0) + x.qty));
      out.defects = Array.from(m.entries()).map(([label, qty]) => ({ label, qty })).sort((a, b) => b.qty - a.qty);
    }
    if (type === 'production' || type === 'custom') out.machines = (s.byMachine || []).filter((x) => x.machine);
    return out;
  }
  /* ---------- Bloques HTML de correo ---------- */
  const tile = (label, value, color, w = 20) => `<td style="padding:6px;" width="${w}%" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:12px;"><tr><td style="padding:12px 14px;font-family:${FONT};"><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.text};">${esc(label)}</div><div style="font-size:22px;font-weight:700;color:${color || C.ink};margin-top:4px;">${value}</div></td></tr></table></td>`;
  const tiles = (arr) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 10px;"><tr>${arr.map((a) => tile(a[0], a[1], a[2], Math.floor(100 / arr.length))).join('')}</tr></table>`;
  const h2 = (t) => `<div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.text};margin:22px 0 10px;">${esc(t)}</div>`;
  const th = (t, right) => `<th align="${right ? 'right' : 'left'}" style="padding:9px 10px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${C.text};border-bottom:2px solid ${C.line};white-space:nowrap;">${esc(t)}</th>`;
  const td = (v, o = {}) => `<td align="${o.right ? 'right' : 'left'}" style="padding:10px;font-family:${FONT};font-size:13.5px;color:${o.color || C.ink};font-weight:${o.bold ? 700 : 400};border-bottom:1px solid ${C.line};${o.bg ? 'background:' + o.bg + ';' : ''}">${v}</td>`;
  const table = (heads, rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><thead><tr>${heads.map((h) => th(h[0], h[1])).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;

  function bodyGeneral(d, T) {
    const s = d.s, rows = d.parts.map((p) => `<tr>${td(`<b>${esc(p.part)}</b>`)}${td(esc(p.customer), { color: C.text })}${td(pc(p.oee), { right: 1, bold: 1, color: tone(p.oee, T.oee) })}${td(pc(p.scrapRate, 2), { right: 1 })}${td(pc(p.ftq), { right: 1 })}${td(p.ppm == null ? '—' : num(p.ppm), { right: 1 })}${td(num(p.down), { right: 1 })}</tr>`);
    rows.push(`<tr>${td('<b>Total</b>', { bg: C.soft })}${td('', { bg: C.soft })}${td(pc(s.oee), { right: 1, bold: 1, bg: C.soft, color: tone(s.oee, T.oee) })}${td(pc(s.scrapAvg, 2), { right: 1, bold: 1, bg: C.soft })}${td(pc(s.ftq), { right: 1, bold: 1, bg: C.soft })}${td(d.ppm == null ? '—' : num(d.ppm), { right: 1, bold: 1, bg: C.soft })}${td(num(s.downMin), { right: 1, bold: 1, bg: C.soft })}</tr>`);
    return tiles([['OEE', pc(s.oee), tone(s.oee, T.oee)], ['Scrap %', pc(s.scrapAvg, 2)], ['FTQ', pc(s.ftq)], ['PPMs', d.ppm == null ? '—' : num(d.ppm)], ['Downtime', `${num(s.downMin)} <span style="font-size:12px;color:${C.text};">min</span>`]])
      + h2('By part number') + table([['Part number'], ['Customer'], ['OEE', 1], ['Scrap %', 1], ['FTQ', 1], ['PPMs', 1], ['Downtime (min)', 1]], rows);
  }
  function bodyQuality(d) {
    const s = d.s, max = d.defects[0] ? d.defects[0].qty : 1, tot = s.scrap || 1;
    const rank = (s.scrapRank || []).map((r) => `<td width="33%" valign="top" style="padding:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:12px;"><tr><td style="padding:14px;font-family:${FONT};"><div style="font-size:11px;font-weight:700;color:${C.cyan};letter-spacing:.08em;">#${r.rank}</div><div style="font-size:15px;font-weight:700;color:${C.ink};">${esc(r.part)}</div><div style="font-size:12px;color:${C.text};margin-bottom:8px;">${esc(r.customer)}</div><div style="font-size:20px;font-weight:700;color:${C.stop};">${num(r.scrap)} <span style="font-size:12px;color:${C.text};font-weight:400;">pcs · ${pc(r.scrapRate, 2)}</span></div><table role="presentation" width="100%" style="margin-top:8px;border-collapse:collapse;">${r.defects.map((x) => `<tr><td style="font-size:11px;font-weight:700;color:${C.cyan};padding:3px 0;white-space:nowrap;">Rank ${x.rank}</td><td style="font-size:12.5px;color:${C.ink};padding:3px 6px;">${esc(x.label)}</td><td align="right" style="font-size:12.5px;font-weight:700;color:${C.ink};padding:3px 0;">${num(x.qty)}</td></tr>`).join('')}</table></td></tr></table></td>`);
    const defRows = d.defects.slice(0, 12).map((x) => `<tr>${td(esc(x.label))}${td(num(x.qty), { right: 1, bold: 1 })}${td(pc(x.qty / tot, 0), { right: 1, color: C.text })}${td(`<div style="width:120px;height:8px;background:${C.line};border-radius:4px;"><div style="width:${Math.max(3, Math.round(x.qty / max * 100))}%;height:8px;background:${C.cyan};border-radius:4px;"></div></div>`)}</tr>`);
    return tiles([['Scrap %', pc(s.scrapAvg, 2), C.stop], ['FTQ', pc(s.ftq)], ['PPMs', d.ppm == null ? '—' : num(d.ppm)], ['Scrap qty', num(s.scrap)]])
      + h2('Scrap Rank — top 3 part numbers') + (rank.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${rank.join('')}</tr></table>` : `<p style="font-family:${FONT};color:${C.text};">No scrap recorded in this period.</p>`)
      + h2('Defects with quantities') + (defRows.length ? table([['Defect'], ['Quantity', 1], ['Share', 1], ['']], defRows) : '');
  }
  function bodyProduction(d, T) {
    const s = d.s, ms = d.machines, rows = ms.map((m) => `<tr>${td(`<b>${esc(m.code)}</b> <span style="color:${C.text};">${esc(m.machine.name)}</span>`)}${td(esc([m.process, m.parts && m.parts.length ? 'NP ' + m.parts.join(', ') : ''].filter(Boolean).join(' · ')), { color: C.text })}${td(pc(m.oee, 0), { right: 1, bold: 1, color: tone(m.oee, T.oee) })}${td(pc(m.a, 0), { right: 1 })}${td(num(m.downMin), { right: 1 })}${td(pc(m.scrapRate, 2), { right: 1 })}</tr>`);
    return tiles([['Plant OEE', pc(s.oee), tone(s.oee, T.oee)], ['Availability', pc(s.a, 0)], ['Machines', String(ms.length)], ['Downtime', `${num(s.downMin)} <span style="font-size:12px;color:${C.text};">min</span>`], ['Scrap %', pc(s.scrapRate, 2)]])
      + h2('Health by machine') + table([['Machine'], ['Process / part numbers'], ['OEE', 1], ['Avail.', 1], ['Downtime (min)', 1], ['Scrap', 1]], rows);
  }

  /* ---------- Bloques del reporte personalizado ---------- */
  const BLOCKS = [   // [id, etiqueta, tipo, grupo]
    ['oee', 'OEE (plant)', 'kpi'], ['availability', 'Availability', 'kpi'], ['performance', 'Performance', 'kpi'], ['quality', 'Quality', 'kpi'], ['ftq', 'FTQ', 'kpi'], ['scrap_pct', 'Scrap % (avg of part numbers)', 'kpi'], ['ppm', 'PPMs', 'kpi'], ['copq', 'COPQ %', 'kpi'], ['total', 'Total produced', 'kpi'], ['good', 'Good parts', 'kpi'], ['scrap_qty', 'Scrap quantity', 'kpi'], ['downtime', 'Total downtime', 'kpi'],
    ['oee_machine', 'OEE by machine', 'table'], ['scrap_machine', 'Scrap by machine', 'table'], ['downtime_machine', 'Downtime by machine', 'table'], ['part_table', 'By part number (OEE, Scrap %, FTQ, PPMs, Downtime)', 'table'], ['scrap_defect', 'Scrap by defect', 'table'], ['downtime_reason', 'Downtime by reason', 'table'], ['scrap_rank', 'Scrap Rank (top 3 part numbers)', 'table'], ['health', 'Health by machine', 'table'], ['plan_vs_actual', 'Production vs plan by part number', 'table'], ['oee_day', 'OEE by day', 'table']
  ];
  const bar = (v, max) => `<div style="width:120px;height:8px;background:${C.line};border-radius:4px;"><div style="width:${Math.max(3, Math.round(v / (max || 1) * 100))}%;height:8px;background:${C.cyan};border-radius:4px;"></div></div>`;
  function bodyCustom(d, T, blocks) {
    const s = d.s, has = (id) => blocks.includes(id), out = [];
    const KP = { oee: ['OEE', pc(s.oee), tone(s.oee, T.oee)], availability: ['Availability', pc(s.a)], performance: ['Performance', pc(s.p)], quality: ['Quality', pc(s.q)], ftq: ['FTQ', pc(s.ftq)], scrap_pct: ['Scrap %', pc(s.scrapAvg, 2)], ppm: ['PPMs', d.ppm == null ? '—' : num(d.ppm)], copq: ['COPQ %', pc(s.copq)], total: ['Total produced', num(s.total)], good: ['Good parts', num(s.good)], scrap_qty: ['Scrap qty', num(s.scrap)], downtime: ['Downtime', `${num(s.downMin)} <span style="font-size:12px;color:${C.text};">min</span>`] };
    const kp = BLOCKS.filter((b) => b[2] === 'kpi' && has(b[0])).map((b) => KP[b[0]]); for (let i = 0; i < kp.length; i += 4) out.push(tiles(kp.slice(i, i + 4)));
    const sec = (title, html) => out.push(h2(title) + html), mach = d.machines || [], maxOf = (a, f) => Math.max.apply(null, a.map(f).concat([1]));
    if (has('oee_machine')) sec('OEE by machine', table([['Machine'], ['OEE', 1], ['Produced', 1]], mach.slice().sort((a, b) => (a.oee == null) - (b.oee == null) || a.oee - b.oee).map((m) => `<tr>${td(`<b>${esc(m.code)}</b> <span style="color:${C.text};">${esc(m.machine.name)}</span>`)}${td(pc(m.oee), { right: 1, bold: 1, color: tone(m.oee, T.oee) })}${td(num(m.total), { right: 1 })}</tr>`)));
    if (has('scrap_machine')) sec('Scrap by machine', table([['Machine'], ['Scrap (pcs)', 1], ['Scrap %', 1], ['']], mach.slice().sort((a, b) => b.scrap - a.scrap).map((m) => `<tr>${td(`<b>${esc(m.code)}</b>`)}${td(num(m.scrap), { right: 1, bold: 1 })}${td(pc(m.scrapRate, 2), { right: 1 })}${td(bar(m.scrap, maxOf(mach, (x) => x.scrap)))}</tr>`)));
    if (has('downtime_machine')) { const r = s.downByMachine || []; sec('Downtime by machine', table([['Machine'], ['Minutes', 1], ['']], r.map((x) => `<tr>${td(`<b>${esc(x.label)}</b>`)}${td(num(x.min), { right: 1, bold: 1 })}${td(bar(x.min, maxOf(r, (y) => y.min)))}</tr>`))); }
    if (has('part_table') && d.parts) sec('By part number', table([['Part number'], ['Customer'], ['OEE', 1], ['Scrap %', 1], ['FTQ', 1], ['PPMs', 1], ['Downtime (min)', 1]], d.parts.map((p) => `<tr>${td(`<b>${esc(p.part)}</b>`)}${td(esc(p.customer), { color: C.text })}${td(pc(p.oee), { right: 1, bold: 1, color: tone(p.oee, T.oee) })}${td(pc(p.scrapRate, 2), { right: 1 })}${td(pc(p.ftq), { right: 1 })}${td(p.ppm == null ? '—' : num(p.ppm), { right: 1 })}${td(num(p.down), { right: 1 })}</tr>`)));
    if (has('scrap_defect')) { const r = (d.defects || []).slice(0, 12), tot = s.scrap || 1; sec('Scrap by defect', r.length ? table([['Defect'], ['Quantity', 1], ['Share', 1], ['']], r.map((x) => `<tr>${td(esc(x.label))}${td(num(x.qty), { right: 1, bold: 1 })}${td(pc(x.qty / tot, 0), { right: 1, color: C.text })}${td(bar(x.qty, r[0].qty))}</tr>`)) : `<p style="font-family:${FONT};color:${C.text};">No scrap recorded in this period.</p>`); }
    if (has('downtime_reason')) { const r = (s.downByReason || []).slice(0, 12), tot = s.downMin || 1; sec('Downtime by reason', r.length ? table([['Reason'], ['Minutes', 1], ['Share', 1], ['']], r.map((x) => `<tr>${td(esc(x.label))}${td(num(x.min), { right: 1, bold: 1 })}${td(pc(x.min / tot, 0), { right: 1, color: C.text })}${td(bar(x.min, r[0].min))}</tr>`)) : `<p style="font-family:${FONT};color:${C.text};">No downtime recorded in this period.</p>`); }
    if (has('scrap_rank')) { const rk = (s.scrapRank || []).map((r) => `<td width="33%" valign="top" style="padding:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:12px;"><tr><td style="padding:14px;font-family:${FONT};"><div style="font-size:11px;font-weight:700;color:${C.cyan};letter-spacing:.08em;">#${r.rank}</div><div style="font-size:15px;font-weight:700;color:${C.ink};">${esc(r.part)}</div><div style="font-size:12px;color:${C.text};margin-bottom:8px;">${esc(r.customer)}</div><div style="font-size:20px;font-weight:700;color:${C.stop};">${num(r.scrap)} <span style="font-size:12px;color:${C.text};font-weight:400;">pcs · ${pc(r.scrapRate, 2)}</span></div><table role="presentation" width="100%" style="margin-top:8px;border-collapse:collapse;">${r.defects.map((x) => `<tr><td style="font-size:11px;font-weight:700;color:${C.cyan};padding:3px 0;white-space:nowrap;">Rank ${x.rank}</td><td style="font-size:12.5px;color:${C.ink};padding:3px 6px;">${esc(x.label)}</td><td align="right" style="font-size:12.5px;font-weight:700;color:${C.ink};padding:3px 0;">${num(x.qty)}</td></tr>`).join('')}</table></td></tr></table></td>`); sec('Scrap Rank — top 3 part numbers', rk.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${rk.join('')}</tr></table>` : `<p style="font-family:${FONT};color:${C.text};">No scrap recorded in this period.</p>`); }
    if (has('health')) sec('Health by machine', table([['Machine'], ['Process / part numbers'], ['OEE', 1], ['Avail.', 1], ['Downtime (min)', 1], ['Scrap', 1]], mach.map((m) => `<tr>${td(`<b>${esc(m.code)}</b> <span style="color:${C.text};">${esc(m.machine.name)}</span>`)}${td(esc([m.process, m.parts && m.parts.length ? 'NP ' + m.parts.join(', ') : ''].filter(Boolean).join(' · ')), { color: C.text })}${td(pc(m.oee, 0), { right: 1, bold: 1, color: tone(m.oee, T.oee) })}${td(pc(m.a, 0), { right: 1 })}${td(num(m.downMin), { right: 1 })}${td(pc(m.scrapRate, 2), { right: 1 })}</tr>`)));
    if (has('plan_vs_actual')) sec('Production vs plan', table([['Part number'], ['Customer'], ['Planned', 1], ['Produced', 1], ['Compliance', 1]], (s.byPart || []).map((p) => `<tr>${td(`<b>${esc(p.part)}</b>`)}${td(esc(p.customer), { color: C.text })}${td(num(p.planned), { right: 1 })}${td(num(p.produced), { right: 1 })}${td(pc(p.compliance, 1), { right: 1, bold: 1, color: tone(p.compliance, 1) })}</tr>`)));
    if (has('oee_day')) sec('OEE by day', table([['Date'], ['OEE', 1], ['Produced', 1]], (s.byDay || []).filter((x) => x.total > 0).map((x) => `<tr>${td(esc(U.fmtDate(x.date)))}${td(pc(x.oee), { right: 1, bold: 1, color: tone(x.oee, T.oee) })}${td(num(x.total), { right: 1 })}</tr>`)));
    return out.join('') || `<p style="font-family:${FONT};color:${C.text};padding:20px 0;">Nothing selected for this notice.</p>`;
  }

  /** Construye {subject, html, text, hasData, range} para un notice y un periodo (por defecto el natural de su frecuencia) */
  async function buildCore(n, periodKey) {
    const tf = (x) => (G.lang === 'es' ? G.i18n.tForce(x) : x), accent = n.color || C.cyan, period = periodKey || periodFor(n.frequency), d = await gather(n.report_type, period, n.blocks || []), R = REPORTS[n.report_type] || REPORTS.general, T = G.Targets.get();
    const r = d.range, dl = r.from === r.to ? U.fmtDate(r.from) : `${U.fmtDate(r.from)} – ${U.fmtDate(r.to)}`, co = G.db.company().name;
    const subject = (n.subject && n.subject.trim()) || `GUVEL · ${tf(R.label)} — ${dl}`;
    const body = !d.hasData ? `<p style="font-family:${FONT};font-size:14px;color:${C.text};padding:24px 0;">No production was recorded in this period (${esc(r.label)}). Nothing to report.</p>` : n.report_type === 'custom' ? bodyCustom(d, T, n.blocks || []) : n.report_type === 'quality' ? bodyQuality(d) : n.report_type === 'production' ? bodyProduction(d, T) : bodyGeneral(d, T);
    const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:${C.card};border-radius:16px;overflow:hidden;">
<tr><td style="background:${C.navy};padding:22px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:.1em;color:#EAF2F8;font-weight:700;">GUVEL</div><div style="font-family:${FONT};font-size:9px;letter-spacing:.22em;color:${C.cyan};font-weight:700;margin-top:3px;">OPERATIONAL SYSTEM</div></td><td align="right" style="font-family:${FONT};font-size:12px;color:#A8BAD3;">${esc(R.label)}<br><span style="color:${accent};font-weight:700;">${esc(r.label)}</span></td></tr></table></td></tr>
<tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:26px 28px 8px;font-family:${FONT};"><div style="font-size:22px;font-weight:700;color:${C.ink};">${esc(n.name || R.label)}</div><div style="font-size:13px;color:${C.text};margin-top:4px;">${esc(co)} · ${esc(dl)}</div></td></tr>
<tr><td style="padding:4px 22px 24px;">${body}</td></tr>
<tr><td style="background:${C.soft};padding:16px 28px;font-family:${FONT};font-size:11.5px;color:${C.text};line-height:1.5;">Sent automatically by <b>GUVEL Operational System</b> · ${esc(when(n))} (${esc(n.timezone)}) · covers ${esc(covers(n))}.<br>Prepared with Ramiro AI. You receive this notice because you are on its recipients list.</td></tr>
</table></td></tr></table>`;
    const text = [subject, `${co} · ${dl}`, '', `OEE ${pc(d.s.oee)} · Scrap ${pc(d.s.scrapAvg, 2)} · FTQ ${pc(d.s.ftq)} · PPMs ${d.ppm == null ? '—' : num(d.ppm)} · Downtime ${num(d.s.downMin)} min`].join('\n');
    return { subject, html, text, hasData: d.hasData, range: r, period };
  }

  /** Construye el correo en el idioma del notice (n.language) o el de la interfaz; las fechas y el HTML se generan en ese idioma */
  async function build(n, periodKey, langOverride) {
    const lang = langOverride || n.language || G.lang, prev = G.lang;
    G.lang = lang;
    try {
      const out = await buildCore(n, periodKey);
      if (lang === 'es') { out.html = G.i18n.html(out.html, 'es'); out.text = G.i18n.tForce(out.subject) + '\n' + out.text.split('\n').slice(1).join('\n'); if (!(n.subject && n.subject.trim())) out.subject = G.i18n.tForce(out.subject); }
      out.lang = lang; return out;
    } finally { G.lang = prev; }
  }
  /* ---------- Próximo envío (según la zona horaria elegida) ---------- */
  const tzOffset = (ms, tz) => { try { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms) / 60000; } catch (e) { return 0; } };
  function nextRun(n, from = new Date()) {
    const [hh, mm] = String(n.send_time || '07:00').split(':').map(Number);
    for (let i = 0; i < 400; i++) {
      const base = new Date(from.getTime() + i * 864e5), p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: n.timezone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(base).map((x) => [x.type, x.value]));
      const y = +p.year, mo = +p.month, d = +p.day, dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
      if (n.frequency === 'weekly' && dow !== Number(n.weekday)) continue; if (n.frequency === 'monthly' && d !== Number(n.month_day)) continue;
      const guess = Date.UTC(y, mo - 1, d, hh, mm), at = guess - tzOffset(guess, n.timezone) * 60000;
      if (at > from.getTime()) return new Date(at);
    }
    return null;
  }
  const fmtNext = (n) => { const d = nextRun(n); return d ? new Intl.DateTimeFormat('en-US', { timeZone: n.timezone, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) + ' · ' + n.timezone.split('/').pop().replace(/_/g, ' ') : '—'; };

  G.NoticeEmail = { BLOCKS, REPORTS, PERIODS, FREQ, DAYS, periodFor, when, covers, build, nextRun, fmtNext };
})();
