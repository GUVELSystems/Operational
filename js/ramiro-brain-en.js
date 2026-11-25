/* ramiro-brain-en.js — motor de conversación LOCAL de Ramiro AI en inglés (mismo orden y mismas capacidades que ramiro-brain.js).
   Se usa cuando G.lang !== 'es'. */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, esc = U.esc, B = G.RamiroBrain;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const STOP = new Set('the a an of on in is are was what which who how many much give me show tell about for to and or with this that these those it its my our your do does you can could please open go take find machine machines part parts number numbers operator supervisor lot shift oee cycle hours running idle session status current now'.split(' '));
  const SECTIONS = [['dashboard', /dashboard|plant now|main panel|home/], ['production', /production|machine status|sessions/], ['runs', /\bruns?\b/], ['customers', /customers|clients/], ['parts', /part numbers?|parts/], ['machines', /machines/], ['catalog', /catalog|defects list|scrap and downtime/], ['registers', /registers|records/], ['notices', /notices?|email reports?|scheduled reports?/], ['personnel', /personnel|staff|operators/], ['settings', /settings|preferences|shifts/]];
  const TITLES = { dashboard: 'Dashboard', production: 'Production', runs: 'Runs', customers: 'Customers', parts: 'Part Numbers', machines: 'Machines', catalog: 'Scrap & Downtime', registers: 'Registers', notices: 'Notices', personnel: 'Personnel', settings: 'Settings' };

  const findMachines = (nq, s) => {
    const c = nq.match(/\b(prs|cnc|inj)\s*-?\s*(\d{1,2})\b/);
    if (c) { const x = s.m.machines.find((mm) => mm.code === `${c[1].toUpperCase()}-${c[2].padStart(2, '0')}`); if (x) return [x]; }
    const fam = /\b(presses|press|stamping)\b/.test(nq) ? 'PRS' : /\bcnc\b|machining/.test(nq) ? 'CNC' : /\binjection|molding\b/.test(nq) ? 'INJ' : null;
    return fam ? s.m.machines.filter((mm) => mm.code.startsWith(fam)) : [];
  };
  const findParts = (nq, s) => {
    const c = nq.match(/[a-z]{3}-[a-z]{3}-\d{3,4}/); if (c) { const p = s.m.part_numbers.find((x) => U.norm(x.part_number) === c[0]); if (p) return [p]; }
    const toks = nq.split(' ').filter((w) => w.length >= 4 && !STOP.has(w)); if (!toks.length) return [];
    const sc = s.m.part_numbers.map((p) => { const hay = U.norm(`${p.part_number} ${p.description}`).split(/[^a-z0-9]+/); let n = 0; toks.forEach((w) => { if (hay.some((h) => h === w || (w.length >= 5 && h.startsWith(w)) || (w.length >= 5 && B._lev(w, h) <= 1))) n++; }); return { p, n }; }).filter((x) => x.n).sort((a, b) => b.n - a.n);
    if (!sc.length || sc[0].n < Math.ceil(toks.length / 2)) return []; return sc.filter((x) => x.n === sc[0].n).slice(0, 4).map((x) => x.p);
  };

  B.replyEN = async function (q) {
    const s = await B._snap(), first = (G.user && G.user.name) || 'friend', ctx = G.Ramiro.ctx, m = s.m, T = B._T, lnk = B._lnk, nameOf = B._nameOf;
    const nq = U.norm(q).replace(/[?¡!.,;:()"]/g, ' ').replace(/\s+/g, ' ').trim(), has = (re) => re.test(nq);
    const R = (html, chips, after) => ({ html, chips: chips || [], after }), go = (p) => () => G.Router.go(p);
    const h = new Date().getHours(), part = h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
    const live = s.live, running = live.filter((x) => x.session), below = live.filter((x) => x.state === 'watch'), idle = live.filter((x) => !x.session);

    /* 1 · Small talk */
    if (has(/^(hi|hello|hey|hiya|good morning|good afternoon|good evening|howdy|greetings|yo)\b/)) return R(pick([`Hi, ${esc(first)}! 🐶 ${part}. What would you like to know about the plant?`, `Hello! Great to see you, ${esc(first)}. Shall we check the OEE?`, `${part}, ${esc(first)} ✨ I'm here, tail wagging.`]), B.sectionChips());
    if (has(/how are you|how is it going|how are things|what s up/)) return R('Doing great, thanks for asking! Watching over your machines 🐾 How is your shift going?', ['Give me a summary']);
    if (has(/thank|thanks|awesome|perfect|great job|nice work/)) return R(pick(['Happy to help! That is what I am here for 🐾', `Anytime, ${esc(first)}. I'm here if you need anything else.`]), ['What can you do?']);
    if (has(/bye|goodbye|see you|later/)) return R(`See you soon, ${esc(first)}! I'll keep watching the plant 🐶`);
    if (has(/who are you|your name|what are you|are you an ai/)) return R("I'm <b>Ramiro AI</b>, the assistant of <b>GUVEL Operational</b>. I know your machines, production sessions, OEE, scrap and downtime, and I can take you wherever you need. I work right here with this team's data.", ['What can you do?']);
    if (has(/joke|something funny/)) return R(pick(['Why did the OEE go to therapy? It had availability issues 😅', 'A press without maintenance is like a dog without a walk: sooner or later it makes noise 🐕']));
    if (has(/what time|what day|what date|today s date/)) return R('Today is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.');
    if (has(/what can you do|what do you know|help|options|how can you help/)) return R('I can help you with:<br>• <b>Machines</b>: status, part, lot, operator, session OEE<br>• <b>Part numbers</b>: operations, machines, costs, scrap<br>• <b>Figures</b>: plant OEE, output, scrap, downtime, top defect<br>• <b>Pending</b>: hours not logged in Real Time<br>• <b>Permissions</b> of each role and <b>navigation</b> to any section', ['Which machines are running?', 'Give me a summary', 'What permissions do I have?']);

    /* 2 · Mentioned entity */
    const machines = findMachines(nq, s);
    if (machines.length === 1) return B.aboutMachineEN(machines[0], nq, s, { has, R, go });
    if (machines.length > 1 && has(/machines|presses|cnc|injection|list|which|what/)) return R(`There are <b>${machines.length}</b>:<br>${machines.map((x) => { const l = live.find((y) => y.machine.id === x.id); return `${lnk(x)} · ${esc(x.name)} — ${l && l.session ? 'in session' : 'idle'}`; }).join('<br>')}`, [`What is running on ${machines[0].code}?`]);
    const parts = findParts(nq, s);
    if (parts.length === 1) return B.aboutPartEN(parts[0], nq, s, { has, R });
    if (parts.length > 1) return R(`I found several:<br>${parts.map((p) => `<a data-p="${esc(p.id)}">${esc(p.part_number)}</a> · ${esc(p.description || '')}`).join('<br>')}<br>Which one do you mean?`, parts.slice(0, 3).map((p) => p.part_number));
    const cust = m.customers.find((c) => nq.split(' ').some((w) => w.length >= 3 && (U.norm(c.code) === w || U.norm(c.name).split(' ')[0] === w)));
    if (cust) { const ps = m.part_numbers.filter((p) => p.customer_id === cust.id); return R(`<b>${esc(cust.name)}</b> (${esc(cust.code)}) has <b>${ps.length}</b> part number${ps.length === 1 ? '' : 's'}:<br>${ps.map((p) => esc(p.part_number)).join(', ')}.`, ['Give me a summary']); }

    /* 3 · Navigation */
    if (has(/\b(take me|go to|open|show me|navigate|bring me)\b/)) { const sec = SECTIONS.find((x) => x[1].test(nq)); if (sec) return R(`Done, taking you to <b>${TITLES[sec[0]]}</b> ✨${G.can('capture') || sec[0] === 'dashboard' ? '' : ' (read-only with your role 🔒)'}`, [], go(sec[0])); }
    if (has(/where am i|what is this screen|what am i seeing/)) { const id = G.Router && G.Router.id, info = { dashboard: 'your OEE, quality and downtime KPIs, plus Plant Now with the live status.', production: 'each machine status; here you start production, log hour by hour and close sessions.', registers: 'every production, scrap and downtime record; you can export them to CSV.', parts: 'part numbers with their operations, machines, defects and barcode.', machines: 'your machines and the part numbers each one can run.', catalog: 'the scrap defects and downtime reasons.', notices: 'scheduled email reports with preview.', settings: 'shifts and your preferences.' }; return R(`You are in <b>${esc(TITLES[id] || 'GUVEL Operational')}</b>${info[id] ? ': ' + info[id] : '.'}`, B.sectionChips()); }

    /* 4 · Figures and lists */
    const noData = () => R('I do not have that figure yet 🐾 Open the <a data-go="dashboard">Dashboard</a> to see it.', ['Give me a summary']);
    if (has(/how many machines|which machines|machines (running|active|in production|idle|stopped)|plant status|machines below|below target/)) {
      if (!live.length) return noData();
      if (has(/below|under target/)) return R(below.length ? `<b>${below.length}</b> below target (${U.pct(T().oee, 0)}):<br>${below.map((x) => `${lnk(x.machine)} · OEE ${U.pct(x.oee)}`).join('<br>')}` : 'No machine is below target right now 🎉', ['Which machines are running?']);
      if (has(/idle|stopped/)) return R(`<b>${idle.length}</b> idle:<br>${idle.map((x) => lnk(x.machine)).join(', ') || '—'}`, ['Which machines are running?']);
      return R(`<b>${running.length}</b> running and <b>${idle.length}</b> idle out of ${live.length}.<br>${running.map((x) => `${lnk(x.machine)} · ${esc((x.session.part_numbers || {}).part_number || '')} · OEE ${U.pct(x.oee)}`).join('<br>')}`, below.length ? ['Which machines are below target?'] : ['Give me a summary']);
    }
    if (has(/\boee\b|efficiency|availability|performance/)) { const mo = s.month, tg = T(); if (!mo || mo.oee == null) return noData(); return R(`Plant OEE this month: <b>${U.pct(mo.oee)}</b> (target ${U.pct(tg.oee, 0)}).<br>Availability ${U.pct(mo.a)} · Performance ${U.pct(mo.p)} · Quality ${U.pct(mo.q)}.${s.plant && s.plant.oee != null ? `<br>Live (active sessions): <b>${U.pct(s.plant.oee)}</b>.` : ''}`, ['Which machines are below target?', 'Give me a summary']); }
    if (has(/top defect|main defect|most scrap|worst defect/)) { const d = s.top && s.top.defect; return d && d[0] ? R(`Over the last 30 days the top defect is <b>${esc(d[0][0])}</b> with ${U.fmtNum(d[0][1])} pieces.${d[1] ? `<br>Next: ${esc(d[1][0])} (${U.fmtNum(d[1][1])}).` : ''}`, ['What is the top downtime?']) : noData(); }
    if (has(/top downtime|main downtime|most downtime|biggest stop|main stop/)) { const d = s.top && s.top.down; return d && d[0] ? R(`Over the last 30 days the top unplanned downtime is <b>${esc(d[0][0])}</b> with ${U.fmtNum(d[0][1])} min.${d[1] ? `<br>Next: ${esc(d[1][0])} (${U.fmtNum(d[1][1])} min).` : ''}`, ['What is the top defect?']) : noData(); }
    if (has(/how many (part numbers|parts|customers|operations)/)) return R(`There are <b>${m.part_numbers.length}</b> part numbers, <b>${m.customers.length}</b> customers and <b>${m.operations.length}</b> operations.`, ['Find ACM-BRK-1001']);
    if (has(/today s production|how much (did we|was)|pieces today|produced today|output today/)) { const t = s.today; return t && t.total ? R(`Today so far: <b>${U.fmtNum(t.total)}</b> pieces produced (${U.fmtNum(t.good)} good, ${U.fmtNum(t.scrap)} scrap).`, ['Give me a summary']) : R('There are no final captures for today yet; Real Time hours are consolidated when the session finishes 🐾', ['Which machines are running?']); }
    if (has(/pending|to log|not logged|overdue hours|what is due/)) { if (!s.missing.length) return R('You have no hours pending. Nice work! 🎉', ['Give me a summary']); return R(`Hours not logged in Real Time:<br>${s.missing.map((x) => `${lnk(x.s.machines)} · <b>${x.n}</b> hour${x.n > 1 ? 's' : ''}`).join('<br>')}`, [`What is running on ${s.missing[0].s.machines.code}?`]); }
    if (has(/summary|overview|how is everything|what s new|news/)) { const mo = s.month, miss = s.missing.reduce((a, x) => a + x.n, 0); return R(`Today's summary, ${esc(first)}:<br>• <b>${running.length}</b> machines running, ${below.length} below target, ${idle.length} idle<br>${mo && mo.oee != null ? `• OEE this month <b>${U.pct(mo.oee)}</b> (target ${U.pct(T().oee, 0)})<br>` : ''}• ${miss ? `<a data-go="production">${miss} hour${miss > 1 ? 's' : ''} not logged</a>` : 'No hours pending'}${s.top && s.top.defect[0] ? `<br>• Top defect: ${esc(s.top.defect[0][0])}` : ''}`, ['Pending', 'What is the plant OEE?']); }

    /* 5 · Permissions */
    if (has(/permission|what can i|\bwhat roles?\b|what can each|\broles?\b/)) { const role = G.user.role, p = G.PERMS[role], ok = (k) => (p[k] ? '✅' : '❌'); if (has(/each role|roles/) && !has(/\bmy\b|\bi have\b/)) return R('Five roles:<br>• <b>owner / admin</b>: everything<br>• <b>manager</b>: capture, master data, personnel and deleting records (no Settings)<br>• <b>supervisor</b>: capture and export<br>• <b>guest</b>: view only<br><small>(proposed matrix, pending validation with RLS)</small>', ['What permissions do I have?']); return R(`You are <b>${esc(role)}</b>:<br>${ok('capture')} Start sessions and capture<br>${ok('masters')} Edit master data and catalogs<br>${ok('deleteRegisters')} Delete in Registers<br>${ok('export')} Export CSV<br>${ok('settings')} Edit shifts<br>${ok('notices')} Manage notices`, ['What can each role do?']); }
    if (has(/(start|begin|finish|close|end|log|capture)/) && has(/production|session|hour|real time/)) return G.can('capture') ? R('Go to <a data-go="production">Production</a>, pick the machine, and there you start the session, log hour by hour (Real Time) and close it with Finish Session 🐾') : R(`With your role (${esc(G.user.role)}) you cannot capture production 🔒. Ask a supervisor or manager to do it.`);

    /* 6 · Follow-up with context */
    const short = nq.split(' ').length <= 6, follow = (re) => has(/operator|supervisor|\blot\b|\boee\b|hours logged|shift|how is it going|status/) || (short && re.test(nq));
    if (ctx.machine && m.byId.machines[ctx.machine] && follow(/\b(and|its|it|that|this)\b/)) return B.aboutMachineEN(m.byId.machines[ctx.machine], nq, s, { has, R, go });
    if (ctx.part && m.byId.part_numbers[ctx.part] && (has(/operations|cost|which customer/) || (short && /\b(and|its|it|that|this)\b/.test(nq)))) return B.aboutPartEN(m.byId.part_numbers[ctx.part], nq, s, { has, R });

    /* 7 · Not understood */
    const words = nq.split(' ').filter((w) => w.length >= 5 && !STOP.has(w)); let best = null;
    m.part_numbers.forEach((p) => U.norm(p.part_number + ' ' + p.description).split(/[^a-z0-9]+/).forEach((hw) => words.forEach((w) => { const d = B._lev(w, hw); if (hw.length >= 4 && d <= 2 && (!best || d < best.d)) best = { p, d }; })));
    if (best) return R(`I'm not sure… do you mean <a data-p="${esc(best.p.id)}">${esc(best.p.part_number)}</a> · ${esc(best.p.description || '')}?`, [best.p.part_number]);
    return R('Hmm, I do not know that yet 🐾 Try a machine (“PRS-02”), a part number, or ask me about “OEE”, “pending”, “top defect” or “what can you do?”.', ['What can you do?', 'Give me a summary']);
  };

  B.aboutMachineEN = async function (mach, nq, s, k) {
    const { has, R, go } = k, T = B._T, lnk = B._lnk, nameOf = B._nameOf, l = s.live.find((x) => x.machine.id === mach.id), sess = l && l.session; G.Ramiro.ctx.machine = mach.id;
    const nextQ = [`Who operates ${mach.code}?`, `What is the OEE of ${mach.code}?`, `Open ${mach.code}`];
    if (has(/\b(open|go to|take me)\b/)) return R(`Opening ${lnk(mach)} in Production ✨`, [], go('production/' + mach.id));
    if (has(/how is|how s|health|analy[sz]e/)) {
      const sm = await G.Calc.summary({ period: 'month', machineId: mach.id }).catch(() => null), tg = T();
      if (sm && sm.total) { const top = sm.scrapByDefect[0], dn = sm.downByReason[0], st = G.statusVsTarget(sm.oee, tg.oee); return R(`${lnk(mach)} this month: OEE <b>${U.pct(sm.oee)}</b> (${st.label}, target ${U.pct(tg.oee, 0)}).<br>Availability ${U.pct(sm.a, 0)} · Performance ${U.pct(sm.p, 0)} · Quality ${U.pct(sm.q, 1)}<br>${U.fmtNum(sm.downMin)} min of downtime${dn ? ` (mostly <i>${esc(dn.label)}</i>)` : ''} · scrap ${U.pct(sm.scrapRate, 2)}${top ? `, top defect <i>${esc(top.label)}</i>` : ''}.${sess ? '' : '<br>It is idle right now.'}`, nextQ); }
    }
    const linked = s.m.links.filter((x) => x.machine_id === mach.id).map((x) => s.m.byId.part_numbers[x.part_number_id]).filter(Boolean);
    if (has(/can run|linked|part numbers|which parts/)) return R(`${lnk(mach)} can run: ${linked.map((p) => esc(p.part_number)).join(', ') || 'no linked parts'}.`, nextQ);
    if (!sess) return R(`${lnk(mach)} (${esc(mach.name)}) is <b>idle</b>, with no production session.${G.can('capture') ? ' You can start one from <a data-go="production/' + esc(mach.id) + '">Production</a>.' : ''}`, [`What can ${mach.code} run?`]);
    const cnt = s.caps.filter((c) => c.session_id === sess.id).length;
    if (has(/operat|who works/)) return R(`<b>${esc(nameOf(sess.operator) || 'No operator assigned')}</b> operates ${lnk(mach)}${sess.supervisor ? `; ${esc(nameOf(sess.supervisor))} supervises` : ''}.`, nextQ);
    if (has(/supervis/)) return R(`${esc(nameOf(sess.supervisor) || 'Nobody')} supervises ${lnk(mach)}.`, nextQ);
    if (has(/\blot\b/)) return R(`The lot on ${lnk(mach)} is <b>${esc(sess.lot_number)}</b>.`, nextQ);
    if (has(/shift/)) return R(`${lnk(mach)} runs on <b>${esc(sess.shifts.name)}</b> (${esc(G.Shift.windowLabel(sess.shifts))}).`, nextQ);
    if (has(/\boee\b|efficiency|availability|performance|quality/)) return R(l.oee != null ? `Session OEE of ${lnk(mach)}: <b>${U.pct(l.oee)}</b><br>Availability ${U.pct(l.a)} · Performance ${U.pct(l.p)} · Quality ${U.pct(l.q)}<br>OEE target ${U.pct(T().oee, 0)}. ${G.statusVsTarget(l.oee, T().oee).label}.` : `${lnk(mach)} has no hours logged yet to calculate the session OEE.`, nextQ);
    if (has(/hours|real time|logged/)) return R(`${lnk(mach)} has <b>${cnt}</b> hour${cnt === 1 ? '' : 's'} logged in Real Time.`, nextQ);
    const op = sess.operations;
    return R(`${lnk(mach)} · <b>${l.state === 'watch' ? 'below target' : 'running'}</b><br>${esc(sess.part_numbers.part_number)}${op ? ` · Op ${op.operation_number} ${esc(op.operation_name)}` : ''}<br>Customer ${esc(sess.customers.name)} · Lot ${esc(sess.lot_number)}<br>${l.oee != null ? `Session OEE <b>${U.pct(l.oee)}</b> · ` : ''}${cnt} h logged`, nextQ);
  };

  B.aboutPartEN = async function (p, nq, s, k) {
    const { has, R } = k, lnk = B._lnk; G.Ramiro.ctx.part = p.id;
    const ops = s.m.operations.filter((o) => o.part_number_id === p.id).sort((a, b) => a.operation_number - b.operation_number);
    const mach = s.m.links.filter((x) => x.part_number_id === p.id).map((x) => s.m.byId.machines[x.machine_id]).filter(Boolean), cust = s.m.byId.customers[p.customer_id], runningOn = s.sessions.filter((x) => x.part_number_id === p.id).map((x) => x.machines);
    const nextQ = [`What operations does ${p.part_number} have?`, `Which machines run ${p.part_number}?`];
    if (has(/scrap|defect|rank/)) {
      const sm = await G.Calc.summary({ period: 'month', partNumberId: p.id }).catch(() => null);
      if (!sm || !sm.scrap) return R(`${esc(p.part_number)} has no scrap this month 🎉`, nextQ);
      const d = sm.scrapByDefect.slice(0, 3);
      return R(`Scrap of <b>${esc(p.part_number)}</b> this month: <b>${U.fmtNum(sm.scrap)}</b> pieces (${U.pct(sm.scrapRate, 2)} of output).<br>${d.map((x, i) => `Rank ${i + 1}: ${esc(x.label)} — ${U.fmtNum(x.qty)} (${U.pct(x.qty / sm.scrap, 0)})`).join('<br>')}<br>Scrap cost: <b>${U.money(sm.scrap * (Number(p.scrap_cost) || 0))}</b>.`, nextQ);
    }
    if (has(/operation|cycle/)) return R(`${esc(p.part_number)} has <b>${ops.length}</b> operations:<br>${ops.map((o) => `${o.operation_number} · ${esc(o.operation_name)} — ${o.ideal_cycle_time_seconds} s`).join('<br>')}`, nextQ.slice(1));
    if (has(/machine|runs|where/)) return R(`${esc(p.part_number)} can run on: ${mach.map(lnk).join(', ') || 'no linked machines'}.${runningOn.length ? `<br>Right now it runs on ${runningOn.map(lnk).join(', ')}.` : ''}`, nextQ.slice(0, 1));
    if (has(/cost|price|worth/)) return R(`${esc(p.part_number)}: piece <b>${U.money(p.piece_cost)}</b> · scrap <b>${U.money(p.scrap_cost)}</b>.`, nextQ);
    if (has(/customer|whose/)) return R(`${esc(p.part_number)} belongs to <b>${esc(cust ? cust.name : '—')}</b>.`, nextQ);
    return R(`<a data-p="${esc(p.id)}" data-go="parts">${esc(p.part_number)}</a> · ${esc(p.description || '')}<br>Customer: ${esc(cust ? cust.name : '—')} · ${ops.length} operations · ${mach.length} machines<br>Piece ${U.money(p.piece_cost)} · scrap ${U.money(p.scrap_cost)}${runningOn.length ? `<br>Running now on ${runningOn.map(lnk).join(', ')}` : ''}`, nextQ);
  };
})();
