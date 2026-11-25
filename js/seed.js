/* seed.js — datos semilla realistas (1 compañía, 3 clientes, 6 partes, 8 máquinas, ~600 capturas en 45 días, 3 sesiones RUNNING) */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U;
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  G.buildSeed = function () {
    const rnd = mulberry(20261120);
    const R = (a, b) => a + (b - a) * rnd(), RI = (a, b) => Math.floor(R(a, b + 1)), pick = (a) => a[Math.floor(rnd() * a.length)];
    const nowISO = new Date().toISOString();
    const co = 'co-guvel-demo';
    const mk = (o) => ({ id: U.uid(), company_id: co, created_at: nowISO, ...o });
    const T = {};
    ['companies', 'customers', 'part_numbers', 'machines', 'part_number_machines', 'operations', 'operation_machine_cycle_times', 'shifts', 'personnel', 'scrap_catalog', 'downtime_catalog', 'machine_production_sessions', 'production_captures', 'scrap_events', 'downtime_events'].forEach((t) => (T[t] = []));
    T.companies.push({ id: co, company_id: co, name: 'GUVEL Demo Plant', created_at: nowISO });

    /* clientes */
    const cus = {};
    [['ACM', 'Acme Automotive'], ['TRX', 'Torrex Appliances'], ['NVA', 'Novaline Electronics']].forEach(([code, name]) => { cus[code] = mk({ code, name }); T.customers.push(cus[code]); });

    /* máquinas */
    const mac = {};
    [['PRS-01', 'Press 200T A', 'Schuler'], ['PRS-02', 'Press 200T B', 'Schuler'], ['PRS-03', 'Press 110T', 'Aida'], ['PRS-04', 'Press 110T B', 'Aida'], ['CNC-01', 'Machining Center 1', 'Haas'], ['CNC-02', 'Machining Center 2', 'Mazak'], ['INJ-01', 'Injection 150T', 'Engel'], ['INJ-02', 'Injection 220T', 'Arburg']].forEach(([code, name, brand]) => { mac[code] = mk({ code, name, brand }); T.machines.push(mac[code]); });
    const fam = (m) => m.code.split('-')[0];

    /* partes y operaciones */
    const pn = {}, ops = {};
    const defs = [
      ['ACM', 'ACM-BRK-1001', 'Front bracket LH', 4.8, 3.1, [[10, 'Blanking', 6, 'PRS'], [20, 'Forming', 8, 'PRS'], [30, 'Drill & tap', 42, 'CNC']], ['PRS-01', 'PRS-02', 'CNC-01']],
      ['ACM', 'ACM-HSG-2040', 'Gearbox housing', 38.5, 24, [[10, 'Rough machining', 95, 'CNC'], [20, 'Finish bore', 70, 'CNC']], ['CNC-01', 'CNC-02']],
      ['TRX', 'TRX-PNL-3300', 'Control panel bezel', 2.2, 1.4, [[10, 'Injection molding', 28, 'INJ']], ['INJ-01', 'INJ-02']],
      ['TRX', 'TRX-CLP-3412', 'Mounting clip', 0.35, 0.22, [[10, 'Stamping', 4, 'PRS'], [20, 'Forming', 5, 'PRS']], ['PRS-03', 'PRS-04', 'PRS-01']],
      ['NVA', 'NVA-CVR-5100', 'Sensor cover', 0.9, 0.6, [[10, 'Injection molding', 22, 'INJ']], ['INJ-01', 'INJ-02']],
      ['NVA', 'NVA-HSK-5230', 'Heat sink plate', 6.7, 4.4, [[10, 'Pressing', 7, 'PRS'], [20, 'Mill slots', 55, 'CNC'], [30, 'Deburr', 30, 'CNC']], ['PRS-02', 'PRS-04', 'CNC-02']]
    ];
    defs.forEach(([c, num, desc, pc, sc, olist, machines]) => {
      const p = mk({ customer_id: cus[c].id, part_number: num, description: desc, piece_cost: pc, scrap_cost: sc }); pn[num] = p; T.part_numbers.push(p);
      olist.forEach(([n, name, ct, f]) => { const o = mk({ part_number_id: p.id, operation_number: n, operation_name: name, ideal_cycle_time_seconds: ct, _fam: f }); ops[num + ':' + n] = o; T.operations.push(o); });
      machines.forEach((mc) => T.part_number_machines.push(mk({ part_number_id: p.id, machine_id: mac[mc].id })));
      olist.forEach(([n, , ct, f]) => machines.filter((mc) => fam(mac[mc]) === f).forEach((mc) => { if (rnd() < 0.85) T.operation_machine_cycle_times.push(mk({ operation_id: ops[num + ':' + n].id, part_number_id: p.id, machine_id: mac[mc].id, cycle_time_seconds: +(ct * R(0.94, 1.08)).toFixed(1) })); }));
    });
    T.operations.forEach((o) => { delete o._fam; });
    const opFam = (num, n) => defs.find((d) => d[1] === num)[5].find((x) => x[0] === n)[3];
    const cycleFor = (p, o, m) => { const ov = T.operation_machine_cycle_times.find((x) => x.operation_id === o.id && x.machine_id === m.id); return ov ? ov.cycle_time_seconds : o.ideal_cycle_time_seconds; };

    /* turnos */
    const sh = {};
    [['T1', 'Shift 1 (Day)', '07:00:00', '16:30:00', 30], ['T2', 'Shift 2 (Afternoon)', '14:00:00', '22:00:00', 30], ['T3', 'Shift 3 (Night)', '22:00:00', '06:00:00', 30]].forEach(([code, name, s, e, x]) => { sh[code] = mk({ code, name, start_time: s, end_time: e, excluded_planned_minutes: x }); T.shifts.push(sh[code]); });

    /* personal */
    const pers = [];
    [['E-1001', 'Luis', 'Hernández', 'Operator'], ['E-1002', 'María', 'Gómez', 'Operator'], ['E-1003', 'Jorge', 'Ramírez', 'Operator'], ['E-1004', 'Ana', 'Torres', 'Operator'], ['E-2001', 'Carlos', 'Mendoza', 'Supervisor'], ['E-2002', 'Patricia', 'Salinas', 'Supervisor']].forEach(([employee_id, first_name, last_name, role]) => { const p = mk({ employee_id, first_name, last_name, role, is_active: true }); pers.push(p); T.personnel.push(p); });
    const operators = pers.filter((p) => p.role === 'Operator'), supervisors = pers.filter((p) => p.role === 'Supervisor');
    const fullName = (p) => `${p.first_name} ${p.last_name}`;

    /* catálogo de scrap: General (ambos null) + específicos */
    const sc = (code, defect, category, num, n) => { const r = mk({ code, defect, category, part_number_id: num ? pn[num].id : null, operation_id: num ? ops[num + ':' + n].id : null }); T.scrap_catalog.push(r); return r; };
    sc('GEN-01', 'Handling damage', 'Handling'); sc('GEN-02', 'Dimensional out of tolerance', 'Dimensional'); sc('GEN-03', 'Contamination / dirt', 'Cosmetic');
    sc('BRK-01', 'Burr', 'Process', 'ACM-BRK-1001', 10); sc('BRK-02', 'Crack', 'Material', 'ACM-BRK-1001', 10); sc('BRK-03', 'Wrong angle', 'Dimensional', 'ACM-BRK-1001', 20); sc('BRK-04', 'Thread defect', 'Tooling', 'ACM-BRK-1001', 30);
    sc('HSG-01', 'Porosity', 'Material', 'ACM-HSG-2040', 10); sc('HSG-02', 'Bore oversize', 'Dimensional', 'ACM-HSG-2040', 20); sc('HSG-03', 'Tool mark', 'Cosmetic', 'ACM-HSG-2040', 20);
    sc('PNL-01', 'Short shot', 'Process', 'TRX-PNL-3300', 10); sc('PNL-02', 'Flash', 'Tooling', 'TRX-PNL-3300', 10); sc('PNL-03', 'Sink mark', 'Process', 'TRX-PNL-3300', 10);
    sc('CLP-01', 'Spring-back', 'Process', 'TRX-CLP-3412', 20); sc('CLP-02', 'Burr', 'Tooling', 'TRX-CLP-3412', 10);
    sc('CVR-01', 'Flash', 'Tooling', 'NVA-CVR-5100', 10); sc('CVR-02', 'Weld line', 'Process', 'NVA-CVR-5100', 10);
    sc('HSK-01', 'Flatness out of spec', 'Dimensional', 'NVA-HSK-5230', 10); sc('HSK-02', 'Slot width', 'Dimensional', 'NVA-HSK-5230', 20); sc('HSK-03', 'Burr left', 'Process', 'NVA-HSK-5230', 30);
    const scFor = (p, o) => T.scrap_catalog.filter((c) => c.part_number_id == null || (c.part_number_id === p.id && c.operation_id === o.id));

    /* catálogo de downtime */
    const dtc = {};
    [['D-01', 'Machine breakdown', 'Machine'], ['D-02', 'Sensor / PLC fault', 'Machine'], ['D-03', 'Tool breakage', 'Tooling'], ['D-04', 'Die / mold change', 'Setup'], ['D-05', 'First-piece approval', 'Quality'], ['D-06', 'Quality hold', 'Quality'], ['D-07', 'Waiting for operator', 'Personnel'], ['D-08', 'Waiting for material', 'Material'], ['D-09', 'Forklift / logistics delay', 'Logistics'], ['D-10', 'Preventive maintenance', 'Machine'], ['D-11', 'Team meeting / 5S', 'Personnel'], ['D-12', 'Scheduled changeover', 'Setup']].forEach(([code, downtime, category]) => { dtc[code] = mk({ code, downtime, category }); T.downtime_catalog.push(dtc[code]); });
    const unplannedCodes = ['D-01', 'D-02', 'D-03', 'D-05', 'D-06', 'D-07', 'D-08', 'D-09', 'D-04'], plannedCodes = ['D-10', 'D-11', 'D-12'];

    const addEvents = (capId, qty, scrapTotal, scrapCats, unplMin, planMin) => {
      let left = scrapTotal, n = Math.min(scrapCats.length, scrapTotal ? RI(1, 3) : 0);
      for (let i = 0; i < n; i++) { const q = i === n - 1 ? left : Math.max(1, Math.round(left * R(0.3, 0.7))); if (q <= 0) break; left -= q; T.scrap_events.push(mk({ production_capture_id: capId, scrap_catalog_id: pick(scrapCats).id, quantity: q, reason: rnd() < 0.3 ? pick(['Operator found at inspection', 'Detected on line', 'Customer feedback loop', 'Setup adjustment']) : null })); }
      let um = unplMin, k = unplMin ? RI(1, 3) : 0;
      for (let i = 0; i < k; i++) { const m = i === k - 1 ? um : Math.max(2, Math.round(um * R(0.3, 0.7))); if (m <= 0) break; um -= m; T.downtime_events.push(mk({ production_capture_id: capId, downtime_catalog_id: dtc[pick(unplannedCodes)].id, minutes: m, event_type: 'Unplanned', reason: null })); }
      if (planMin) T.downtime_events.push(mk({ production_capture_id: capId, downtime_catalog_id: dtc[pick(plannedCodes)].id, minutes: planMin, event_type: 'Planned', reason: null }));
    };

    /* historial: ~45 días */
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const machineShifts = { 'PRS-01': ['T1', 'T2'], 'PRS-02': ['T1', 'T2'], 'PRS-03': ['T1', 'T2'], 'PRS-04': ['T1', 'T2'], 'CNC-01': ['T1', 'T2'], 'CNC-02': ['T1', 'T2'], 'INJ-01': ['T1', 'T2'], 'INJ-02': ['T2', 'T3'] };
    const links = (mc) => defs.filter((d) => d[6].includes(mc));
    let lotSeq = 100;
    for (let back = 45; back >= 1; back--) {
      const day = U.addDays(today, -back), dow = day.getDay(); if (dow === 0) continue;
      Object.keys(machineShifts).forEach((mc, mi) => {
        const m = mac[mc];
        machineShifts[mc].forEach((sc2, si) => {
          if ((dow === 6 && si === 1) || rnd() < 0.05) return;
          const cand = links(mc), d = cand[(Math.floor(back / 4) + mi) % cand.length], p = pn[d[1]];
          const opCand = d[5].filter((o) => o[3] === fam(m)); if (!opCand.length) return;
          const o = ops[d[1] + ':' + opCand[(back + si) % opCand.length][0]], s = sh[sc2];
          const planned0 = G.Shift.plannedMin(s), plannedDown = rnd() < 0.35 ? pick([10, 15, 20, 30]) : 0;
          const unpl = rnd() < 0.2 ? RI(65, 105) : RI(4, 58);
          const operating = planned0 - plannedDown - unpl, cyc = cycleFor(p, o, m), perf = R(0.8, 0.97);
          const qty = Math.max(10, Math.round((operating * 60 / cyc) * perf));
          const scrapTotal = Math.min(qty, Math.round(qty * R(0.004, 0.032)));
          const dateStr = U.ymd(day), w = G.Shift.windowForDate(s, dateStr), op = pick(operators), sup = pick(supervisors);
          const cap = mk({ production_date: dateStr, captured_at: w.end.toISOString(), shift_id: s.id, lot_number: `LT-${dateStr.slice(2).replace(/-/g, '')}-${lotSeq++ % 1000}`, customer_id: p.customer_id, part_number_id: p.id, machine_id: m.id, operation_id: o.id, operator_name: fullName(op), supervisor_name: fullName(sup), production_quantity: qty, confirmed: true, session_id: null, hour_slot: null });
          T.production_captures.push(cap); addEvents(cap.id, qty, scrapTotal, scFor(p, o), unpl, plannedDown);
        });
      });
    }

    /* sesiones RUNNING */
    const now = new Date();
    const windowStartNow = (s) => { let w = G.Shift.windowFor(s, now); if (w.start > now) w = { start: new Date(w.start.getTime() - 864e5), end: new Date(w.end.getTime() - 864e5) }; return w; };
    const elapsedH = (s) => (now - windowStartNow(s).start) / 36e5;
    const shiftNow = ['T1', 'T2', 'T3'].map((c) => sh[c]).filter((s) => { const w = windowStartNow(s); return now < w.end; });
    const prefer = shiftNow.slice().sort((a, b) => elapsedH(b) - elapsedH(a));
    const mkSession = (mc, num, opn, shiftRec, withHours) => {
      const m = mac[mc], p = pn[num], o = ops[num + ':' + opn], w = windowStartNow(shiftRec), op = pick(operators), sup = pick(supervisors);
      const s = mk({ machine_id: m.id, shift_id: shiftRec.id, customer_id: p.customer_id, part_number_id: p.id, operation_id: o.id, lot_number: `LT-${U.ymd(w.start).slice(2).replace(/-/g, '')}-${mc.slice(-2)}${RI(1, 9)}`, operator_id: op.id, supervisor_id: sup.id, started_at: new Date(w.start.getTime() + 5 * 60000).toISOString(), finished_at: null, status: 'RUNNING' });
      T.machine_production_sessions.push(s);
      if (withHours) {
        const hrs = G.Shift.hours(shiftRec, s.started_at, now).slots.slice(0, 3);
        hrs.forEach((h, i) => {
          const cyc = cycleFor(p, o, m), unpl = i === 1 ? 12 : RI(0, 6), planMin = i === 0 ? 0 : 0, operating = h.minutes - unpl - planMin;
          const qty = Math.max(5, Math.round(operating * 60 / cyc * R(0.62, 0.9))), scr = Math.min(qty, RI(1, 5));
          const cap = mk({ production_date: U.ymd(h.start), captured_at: h.end.toISOString(), shift_id: shiftRec.id, lot_number: s.lot_number, customer_id: p.customer_id, part_number_id: p.id, machine_id: m.id, operation_id: o.id, operator_name: fullName(op), supervisor_name: fullName(sup), production_quantity: qty, confirmed: true, session_id: s.id, hour_slot: h.key });
          T.production_captures.push(cap);
          if (scr) T.scrap_events.push(mk({ production_capture_id: cap.id, scrap_catalog_id: pick(scFor(p, o)).id, quantity: scr, reason: null }));
          if (unpl) T.downtime_events.push(mk({ production_capture_id: cap.id, downtime_catalog_id: dtc[pick(unplannedCodes)].id, minutes: unpl, event_type: 'Unplanned', reason: null }));
        });
      }
    };
    const s1 = prefer[0] || sh.T1, s2 = prefer[1] || prefer[0] || sh.T1;
    mkSession('PRS-02', 'ACM-BRK-1001', 10, s1, true);
    mkSession('CNC-01', 'ACM-HSG-2040', 20, s2, false);
    mkSession('INJ-01', 'TRX-PNL-3300', 10, s1, false);
    T.notices = G.buildNotices(co);
    return T;
  };
  /** Notices (envíos programados por correo): ejemplos iniciales. ≈ tabla `notices` en Supabase */
  G.buildNotices = function (co) {
    const base = { company_id: co, created_at: new Date().toISOString(), weekday: 1, month_day: 1, timezone: 'America/Mexico_City', active: true, last_sent_at: null, group_by_part: true };
    return [
      { id: U.uid(), ...base, name: 'Daily plant summary', report_type: 'general', frequency: 'daily', send_time: '07:00', recipients: ['plant.manager@example.com', 'operations@example.com'], subject: '' },
      { id: U.uid(), ...base, name: 'Weekly quality review', report_type: 'quality', frequency: 'weekly', weekday: 1, send_time: '08:00', recipients: ['quality@example.com'], subject: '' },
      { id: U.uid(), ...base, name: 'Machine health — monthly', report_type: 'production', frequency: 'monthly', month_day: 1, send_time: '09:00', active: false, recipients: ['maintenance@example.com', 'plant.manager@example.com'], subject: '' }
    ];
  };})();
