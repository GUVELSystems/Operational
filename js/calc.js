/* calc.js — G.Calc: fórmulas de OEE / calidad / downtime (§8.1 periodo) y Session OEE en vivo (§8.2).
   Convenciones:
   - Sin datos → null (nunca NaN). Los porcentajes son fracciones 0..1.
   - delta.{total,good,scrap,downMin} = diferencia RELATIVA ((act-prev)/prev); delta.{ftq,oee,copq} = diferencia en PUNTOS (act-prev, fracción; ×100 = pp).
   - Dashboard: OEE por grupo (fecha+turno+máquina), agregado así: A = Σoperación/Σplanificado; P = Σmin(ideal,operación·60)/Σ(operación·60)
     (ponderado por tiempo de operación, solo grupos con ciclo conocido); Q = Σbuenas/Σproducidas; OEE = A×P×Q.
   - Planificado del grupo = duración turno − excluded − ΣPlanned del grupo (una vez por grupo); operación = planificado − ΣUnplanned.
   - Las horas Real Time de sesiones aún RUNNING NO entran al resumen por periodo (turno parcial distorsionaría el OEE); se consolidan al terminar la sesión.
     filters.includeLive=true las incluye. */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U;
  const Calc = (G.Calc = {});
  const ymd = U.ymd, pd = U.parseYmd, add = U.addDays;
  const SESSION_EMBED = ['machines', 'shifts', 'customers', 'part_numbers', 'operations', 'operator', 'supervisor'];
  const sum = (a, f) => U.sum(a, f);

  /* ---------- Periodos ---------- */
  Calc.periodRange = function (period, from, to) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    let a, b, pa, pb, label;
    switch (period) {
      case 'today': a = b = now; pa = pb = add(now, -1); label = 'Today'; break;
      case 'yesterday': a = b = add(now, -1); pa = pb = add(now, -2); label = 'Yesterday'; break;
      case 'lastweek': { const dow = (now.getDay() + 6) % 7; a = add(now, -dow - 7); b = add(a, 6); pa = add(a, -7); pb = add(a, -1); label = 'Previous Week'; break; }
      case 'year': { const y = now.getFullYear(); a = new Date(y, 0, 1); b = new Date(y, 11, 31); pa = new Date(y - 1, 0, 1); pb = new Date(y - 1, now.getMonth(), now.getDate()); label = 'This Year'; break; }   // mismos días transcurridos del año anterior
      case 'lastyear': { const y = now.getFullYear() - 1; a = new Date(y, 0, 1); b = new Date(y, 11, 31); pa = new Date(y - 1, 0, 1); pb = new Date(y - 1, 11, 31); label = 'Previous Year'; break; }
      case 'week': { const dow = (now.getDay() + 6) % 7; a = add(now, -dow); b = add(a, 6); pa = add(a, -7); pb = add(pa, dow); label = 'This Week'; break; }   // mismos días transcurridos de la semana anterior
      case 'lastmonth': a = new Date(now.getFullYear(), now.getMonth() - 1, 1); b = new Date(now.getFullYear(), now.getMonth(), 0); pa = new Date(a.getFullYear(), a.getMonth() - 1, 1); pb = new Date(a.getFullYear(), a.getMonth(), 0); label = 'Previous Month'; break;
      case 'custom': { a = from ? pd(from) : now; b = to ? pd(to) : a; if (b < a) { const t = a; a = b; b = t; } const len = Math.round((b - a) / 864e5) + 1; pb = add(a, -1); pa = add(a, -len); label = 'Custom range'; break; }
      default: a = new Date(now.getFullYear(), now.getMonth(), 1); b = new Date(now.getFullYear(), now.getMonth() + 1, 0); pa = new Date(now.getFullYear(), now.getMonth() - 1, 1); pb = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate())); label = 'This Month'; period = 'month';   // mismos días transcurridos del mes anterior
    }
    return { period, from: ymd(a), to: ymd(b), label, prevFrom: ymd(pa), prevTo: ymd(pb) };
  };

  /* ---------- Session OEE (§8.2) — función PURA ----------
     hours: [{minutes, qty, scrap, plannedMin, unplannedMin}] — solo horas CAPTURADAS. */
  Calc.sessionFormula = function ({ hours = [], cycleSec = null } = {}) {
    const hasHours = hours.length > 0;
    const loggedMin = sum(hours, (h) => h.minutes), plannedDown = sum(hours, (h) => h.plannedMin), unplannedDown = sum(hours, (h) => h.unplannedMin);
    const pieces = sum(hours, (h) => h.qty), scrap = sum(hours, (h) => h.scrap), good = Math.max(0, pieces - scrap);
    const planned = loggedMin - plannedDown, operating = planned - unplannedDown;
    const a = hasHours && planned > 0 ? operating / planned : null;
    const p = hasHours && cycleSec > 0 && operating > 0 ? Math.min(1, (cycleSec * pieces) / (operating * 60)) : null;
    const q = pieces > 0 ? good / pieces : null;
    const oee = a != null && p != null && q != null ? a * p * q : null;
    return { hasHours, loggedMin, planned, operating, plannedDown, unplannedDown, pieces, good, scrap, scrapRate: pieces > 0 ? scrap / pieces : null, a, p, q, oee };
  };

  /* Carga por lote: horas capturadas (hour_slot ≠ null) de varias sesiones con sus eventos */
  async function loadBatch(sessions) {
    const out = {}; sessions.forEach((s) => (out[s.id] = { caps: [], se: [], de: [] }));
    if (!sessions.length) return out;
    const caps = await G.db.select('production_captures', { where: { session_id: sessions.map((s) => s.id), hour_slot: { isnull: false } } });
    const ids = caps.map((c) => c.id);
    const [se, de] = ids.length ? await Promise.all([G.db.select('scrap_events', { where: { production_capture_id: ids } }), G.db.select('downtime_events', { where: { production_capture_id: ids } })]) : [[], []];
    caps.forEach((c) => { if (out[c.session_id]) out[c.session_id].caps.push(c); });
    const capSession = Object.fromEntries(caps.map((c) => [c.id, c.session_id]));
    se.forEach((e) => out[capSession[e.production_capture_id]].se.push(e));
    de.forEach((e) => out[capSession[e.production_capture_id]].de.push(e));
    return out;
  }
  function metricsFor(session, data, master) {
    const shift = session.shifts || master.byId.shifts[session.shift_id];
    const slotMap = {};
    if (shift) G.Shift.hours(shift, session.started_at, new Date(), 1e6).all.forEach((s) => (slotMap[s.key] = s));
    const hours = data.caps.slice().sort((a, b) => (a.hour_slot < b.hour_slot ? -1 : 1)).map((c) => {
      const sl = slotMap[c.hour_slot], start = sl ? sl.start : new Date(c.hour_slot), end = sl ? sl.end : new Date(start.getTime() + 36e5);
      const se = data.se.filter((e) => e.production_capture_id === c.id), de = data.de.filter((e) => e.production_capture_id === c.id);
      const scrap = sum(se, (e) => e.quantity);
      return { key: c.hour_slot, start, end, minutes: sl ? sl.minutes : 60, qty: c.production_quantity, scrap, good: Math.max(0, c.production_quantity - scrap), down: sum(de, (e) => e.minutes), plannedMin: sum(de.filter((e) => e.event_type === 'Planned'), (e) => e.minutes), unplannedMin: sum(de.filter((e) => e.event_type !== 'Planned'), (e) => e.minutes) };
    });
    const cycleSec = session.operation_id ? G.cycleTime(master, session.part_number_id, session.operation_id, session.machine_id) : null;
    const f = Calc.sessionFormula({ hours, cycleSec });
    return { session, hasHours: f.hasHours, loggedMin: f.loggedMin, plannedMin: f.planned, operatingMin: f.operating, plannedDown: f.plannedDown, unplannedDown: f.unplannedDown, pieces: f.pieces, good: f.good, scrap: f.scrap, scrapRate: f.scrapRate, downMin: sum(hours, (h) => h.down), hoursLogged: hours.length, a: f.a, p: f.p, q: f.q, oee: f.oee, cycleSec: cycleSec > 0 ? cycleSec : null, hours };
  }
  Calc.sessionMetrics = async function (sessionId) {
    const [master, s] = await Promise.all([G.Cache.master(), G.db.get('machine_production_sessions', sessionId, { embed: SESSION_EMBED })]);
    if (!s) return null;
    const b = await loadBatch([s]);
    return metricsFor(s, b[s.id], master);
  };

  /* ---------- Máquinas en vivo (Plant Now) ---------- */
  async function liveAll() {
    const [master, sessions] = await Promise.all([G.Cache.master(), G.db.select('machine_production_sessions', { where: { status: 'RUNNING' }, embed: SESSION_EMBED })]);
    const batch = await loadBatch(sessions), bySess = {};
    sessions.forEach((s) => (bySess[s.machine_id] = { s, m: metricsFor(s, batch[s.id], master) }));
    const num = (c) => parseInt(String(c).split('-')[1], 10) || 0;
    const rows = master.machines.slice().sort((x, y) => { const fx = x.code.split('-')[0], fy = y.code.split('-')[0]; return fx === fy ? num(x.code) - num(y.code) || x.code.localeCompare(y.code) : fx.localeCompare(fy); });
    return { master, rows, bySess };
  }
  Calc.liveMachines = async function () {
    const { rows, bySess } = await liveAll(), target = G.Targets.get().oee;
    return rows.map((machine) => {
      const x = bySess[machine.id], m = x && x.m;
      const state = !x ? 'idle' : m.oee == null || m.oee >= target ? 'run' : 'watch';   // sin horas capturadas todavía: Running (sin dato), no "bajo objetivo"
      return { machine, family: machine.code.split('-')[0], session: x ? x.s : null, state, oee: m ? m.oee : null, a: m ? m.a : null, p: m ? m.p : null, q: m ? m.q : null, hoursLogged: m ? m.hoursLogged : 0, partNumber: x ? x.s.part_numbers : null, operation: x ? x.s.operations : null, metrics: m || null };
    });
  };
  /** OEE de planta "en vivo": promedio ponderado de sesiones activas con datos (A por tiempo planificado, P por tiempo de operación, Q por piezas) */
  Calc.plantLive = async function () {
    const { bySess } = await liveAll(), ms = Object.values(bySess).map((x) => x.m).filter((m) => m.hasHours);
    if (!ms.length) return null;
    const pl = sum(ms, (m) => m.plannedMin), a = pl > 0 ? sum(ms, (m) => m.operatingMin) / pl : null;
    const pm = ms.filter((m) => m.p != null), pw = sum(pm, (m) => m.operatingMin), p = pw > 0 ? sum(pm, (m) => m.p * m.operatingMin) / pw : null;
    const pcs = sum(ms, (m) => m.pieces), q = pcs > 0 ? sum(ms, (m) => m.good) / pcs : null;
    return { oee: a != null && p != null && q != null ? a * p * q : null, a, p, q };
  };

  /* ---------- Resumen por periodo (§8.1) ---------- */
  let cache = null, cacheT = 0, ver = 0, inflight = null;
  G.bus.on('db:change', () => { ver++; cache = null; });
  async function loadAll() {
    if (cache && Date.now() - cacheT < 60000) return cache;
    if (inflight) return inflight;
    const v = ver;
    inflight = (async () => {
      const [master, caps, se, de, running] = await Promise.all([
        G.Cache.master(),
        G.db.select('production_captures', { embed: ['shifts', 'machines', 'operations', 'part_numbers', 'customers'] }),
        G.db.select('scrap_events', { embed: ['scrap_catalog'] }),
        G.db.select('downtime_events', { embed: ['downtime_catalog'] }),
        G.db.select('machine_production_sessions', { where: { status: 'RUNNING' } })
      ]);
      const sBy = {}, dBy = {}, live = new Set(running.map((s) => s.id));
      se.forEach((e) => (sBy[e.production_capture_id] = sBy[e.production_capture_id] || []).push(e));
      de.forEach((e) => (dBy[e.production_capture_id] = dBy[e.production_capture_id] || []).push(e));
      const list = caps.map((c) => {
        const ses = sBy[c.id] || [], des = dBy[c.id] || [], scrap = sum(ses, (e) => e.quantity), cyc = c.operation_id ? G.cycleTime(master, c.part_number_id, c.operation_id, c.machine_id) : null;
        return { cap: c, date: c.production_date, shift: c.shifts, machine: c.machines, pn: c.part_numbers, qty: c.production_quantity, scrap, good: Math.max(0, c.production_quantity - scrap), se: ses, de: des, cyc: cyc > 0 ? cyc : null, live: !!(c.session_id && c.hour_slot && live.has(c.session_id)) };
      });
      const out = { master, list };
      if (v === ver) { cache = out; cacheT = Date.now(); }
      return out;
    })().finally(() => { inflight = null; });
    return inflight;
  }

  /** Métricas de un conjunto de capturas enriquecidas (agregación por grupo fecha+turno+máquina) */
  function compute(list) {
    const groups = new Map();
    let total = 0, good = 0, scrap = 0, goodCost = 0, poorCost = 0, down = 0, pdown = 0, udown = 0;
    const perPart = new Map();   // scrap % por número de parte → KPI "Scrap %" = promedio simple de esas tasas
    list.forEach((e) => {
      total += e.qty; good += e.good; scrap += e.scrap;
      const pp = perPart.get(e.cap.part_number_id) || { q: 0, s: 0 }; pp.q += e.qty; pp.s += e.scrap; perPart.set(e.cap.part_number_id, pp);
      const pn = e.pn || {}; goodCost += e.good * (Number(pn.piece_cost) || 0); poorCost += e.scrap * (Number(pn.scrap_cost) || 0);
      const k = e.date + '|' + e.cap.shift_id + '|' + e.cap.machine_id;
      let g = groups.get(k); if (!g) { g = { shift: e.shift, pd: 0, unpl: 0, ideal: 0, cycQty: 0 }; groups.set(k, g); }
      e.de.forEach((d) => { const m = Number(d.minutes) || 0; down += m; if (d.event_type === 'Planned') { pdown += m; g.pd += m; } else { udown += m; g.unpl += m; } });
      if (e.cyc > 0) { g.ideal += e.cyc * e.qty; g.cycQty += e.qty; }
    });
    let planned = 0, oper = 0, pNum = 0, pDen = 0, plan = 0;
    groups.forEach((g) => {
      const base = g.shift && G.Shift.hasSchedule(g.shift) ? G.Shift.plannedMin(g.shift) : 0;
      const pl = Math.max(0, base - g.pd), op = Math.max(0, pl - g.unpl);
      planned += pl; oper += op;
      if (g.ideal > 0 && op > 0) { pNum += Math.min(g.ideal, op * 60); pDen += op * 60; }
      if (g.cycQty > 0) plan += (pl * 60) / (g.ideal / g.cycQty);
    });
    const a = planned > 0 ? oper / planned : null, p = pDen > 0 ? pNum / pDen : null, q = total > 0 ? good / total : null;
    const cost = goodCost + poorCost, rates = Array.from(perPart.values()).filter((x) => x.q > 0).map((x) => x.s / x.q);
    const scrapAvg = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null;
    return { scrapAvg, total, good, scrap, ftq: total > 0 ? good / total : null, scrapRate: total > 0 ? scrap / total : null, copq: cost > 0 ? poorCost / cost : null, a, p, q, oee: a != null && p != null && q != null ? a * p * q : null, plannedMin: planned, operatingMin: oper, downMin: down, plannedDownMin: pdown, unplannedMin: udown, plan };
  }
  Calc._compute = compute;

  /** Piezas planificadas por número de parte: tiempo planificado del grupo (fecha+turno+máquina) ÷ ciclo ideal, repartido por piezas */
  function planByPart(list) {
    const groups = new Map(), out = new Map();
    list.forEach((e) => {
      const k = e.date + '|' + e.cap.shift_id + '|' + e.cap.machine_id; let g = groups.get(k); if (!g) { g = { shift: e.shift, pd: 0, ideal: 0, cycQty: 0, items: [] }; groups.set(k, g); }
      e.de.forEach((d) => { if (d.event_type === 'Planned') g.pd += Number(d.minutes) || 0; });
      if (e.cyc > 0) { g.ideal += e.cyc * e.qty; g.cycQty += e.qty; } g.items.push(e);
    });
    groups.forEach((g) => {
      if (!(g.cycQty > 0)) return;
      const base = g.shift && G.Shift.hasSchedule(g.shift) ? G.Shift.plannedMin(g.shift) : 0, planG = Math.max(0, base - g.pd) * 60 * g.cycQty / g.ideal;
      g.items.forEach((e) => { if (e.cyc > 0) out.set(e.cap.part_number_id, (out.get(e.cap.part_number_id) || 0) + planG * e.qty / g.cycQty); });
    });
    return out;
  }
  /** Las n claves más producidas de una lista de capturas (p. ej. números de parte o proceso de una máquina) */
  function topKeys(list, fn, n) { const m = new Map(); list.forEach((e) => { const k = fn(e); if (k) m.set(k, (m.get(k) || 0) + e.qty); }); return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]); }
  const rank = (map, key) => Array.from(map.values()).sort((x, y) => y[key] - x[key]);
  const bump = (map, id, base, key, n) => { let r = map.get(id); if (!r) { r = Object.assign({}, base); r[key] = 0; map.set(id, r); } r[key] += n; };
  const rel = (c, p) => (c != null && p != null && p !== 0 ? (c - p) / p : null), pts = (c, p) => (c != null && p != null ? c - p : null);

  Calc.summary = async function (f = {}) {
    const range = Calc.periodRange(f.period || 'month', f.from, f.to);
    const d = await loadAll();
    const sel = (from, to) => d.list.filter((e) => e.date >= from && e.date <= to && (f.includeLive || !e.live) && (!f.customerId || e.cap.customer_id === f.customerId) && (!f.partNumberId || e.cap.part_number_id === f.partNumberId) && (!f.shiftId || e.cap.shift_id === f.shiftId) && (!f.machineId || e.cap.machine_id === f.machineId));
    const cur = sel(range.from, range.to), core = compute(cur), pl = sel(range.prevFrom, range.prevTo);
    const pc = pl.length ? compute(pl) : null;
    const prev = pc ? { total: pc.total, good: pc.good, scrap: pc.scrap, ftq: pc.ftq, oee: pc.oee, downMin: pc.downMin, copq: pc.copq, scrapAvg: pc.scrapAvg } : null;
    const delta = pc ? { scrapAvg: pts(core.scrapAvg, pc.scrapAvg), total: rel(core.total, pc.total), good: rel(core.good, pc.good), scrap: rel(core.scrap, pc.scrap), downMin: rel(core.downMin, pc.downMin), ftq: pts(core.ftq, pc.ftq), oee: pts(core.oee, pc.oee), copq: pts(core.copq, pc.copq) } : null;

    const byDate = new Map(); cur.forEach((e) => { if (!byDate.has(e.date)) byDate.set(e.date, []); byDate.get(e.date).push(e); });
    const byDay = [], last = ymd(new Date()) < range.to ? ymd(new Date()) : range.to;
    for (let dt = pd(range.from); ymd(dt) <= last; dt = add(dt, 1)) {
      const k = ymd(dt), c = compute(byDate.get(k) || []);
      byDay.push({ date: k, total: c.total, good: c.good, scrap: c.scrap, oee: c.oee, ftq: c.ftq, copq: c.copq, scrapAvg: c.scrapAvg, downMin: c.downMin, plan: c.plan });
    }
    while (byDay.length > 31 && !byDay[0].total) byDay.shift();   // periodos largos: sin días vacíos al inicio
    const byM = new Map(); cur.forEach((e) => { if (!byM.has(e.cap.machine_id)) byM.set(e.cap.machine_id, []); byM.get(e.cap.machine_id).push(e); });
    const byMachine = Array.from(byM.values()).map((l) => { const c = compute(l); return { machine: l[0].machine, code: l[0].machine ? l[0].machine.code : '—', total: c.total, good: c.good, scrap: c.scrap, oee: c.oee, a: c.a, downMin: c.downMin, scrapRate: c.scrapRate, parts: topKeys(l, (e) => (e.pn ? e.pn.part_number : null), 2), process: topKeys(l, (e) => (e.cap.operations ? e.cap.operations.operation_name : null), 1)[0] || '' }; }).sort((x, y) => String(x.code).localeCompare(String(y.code)));

    const sd = new Map(), sp = new Map(), sc = new Map(), dr = new Map(), dm = new Map(), dc = new Map();
    cur.forEach((e) => {
      const pn = e.pn ? e.pn.part_number : '—', mc = e.machine ? e.machine.code : '—';
      e.se.forEach((s) => {
        const cg = s.scrap_catalog || {}, q = Number(s.quantity) || 0;
        bump(sd, s.scrap_catalog_id, { label: cg.defect || '—', code: cg.code || '' }, 'qty', q); bump(sp, pn, { label: pn }, 'qty', q); bump(sc, cg.category || '—', { label: cg.category || '—' }, 'qty', q);
      });
      e.de.forEach((x) => {
        const cg = x.downtime_catalog || {}, m = Number(x.minutes) || 0;
        bump(dr, x.downtime_catalog_id, { label: cg.downtime || '—' }, 'min', m); bump(dm, mc, { label: mc }, 'min', m); bump(dc, cg.category || '—', { label: cg.category || '—' }, 'min', m);
      });
    });
    /* Production Real vs Plan por número de parte (plan = tiempo planificado ÷ tiempo de ciclo) y Rank de scrap (3 partes con más scrap × top 3 defectos) */
    const planMap = planByPart(cur), pm = new Map();
    cur.forEach((e) => {
      const id = e.cap.part_number_id; let r = pm.get(id);
      if (!r) { r = { part: e.pn ? e.pn.part_number : '—', customer: e.cap.customers ? e.cap.customers.name : '—', description: e.pn ? e.pn.description : '', produced: 0, scrap: 0, defects: new Map() }; pm.set(id, r); }
      r.produced += e.qty; r.scrap += e.scrap;
      e.se.forEach((s) => { const cg = s.scrap_catalog || {}; bump(r.defects, s.scrap_catalog_id, { label: cg.defect || '—', code: cg.code || '' }, 'qty', Number(s.quantity) || 0); });
    });
    const parts = Array.from(pm.entries()).map(([id, r]) => ({ id, part: r.part, customer: r.customer, description: r.description, planned: Math.round(planMap.get(id) || 0), produced: r.produced, scrap: r.scrap, scrapRate: r.produced ? r.scrap / r.produced : null, defects: rank(r.defects, 'qty') }));
    const byPart = parts.slice().sort((x, y) => String(x.customer).localeCompare(y.customer) || String(x.part).localeCompare(y.part)).map((r) => ({ id: r.id, customer: r.customer, part: r.part, planned: r.planned, produced: r.produced, compliance: r.planned > 0 ? r.produced / r.planned : null }));
    const scrapRank = parts.filter((r) => r.scrap > 0).sort((x, y) => y.scrap - x.scrap).slice(0, 3).map((r, i) => ({ rank: i + 1, part: r.part, customer: r.customer, description: r.description, scrap: r.scrap, produced: r.produced, scrapRate: r.scrapRate, defects: r.defects.slice(0, 3).map((d, j) => ({ rank: j + 1, label: d.label, code: d.code, qty: d.qty, share: r.scrap ? d.qty / r.scrap : null })) }));
    return Object.assign({ range, prev, delta, byDay, byMachine, byPart, scrapRank, scrapByDefect: rank(sd, 'qty'), scrapByPart: rank(sp, 'qty'), scrapByCategory: rank(sc, 'qty'), downByReason: rank(dr, 'min'), downByMachine: rank(dm, 'min'), downByCategory: rank(dc, 'min'), downPlanned: core.plannedDownMin, downUnplanned: core.unplannedMin }, core);
  };
  Calc.invalidate = () => { ver++; cache = null; };
})();
