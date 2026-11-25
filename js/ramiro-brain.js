/* ramiro-brain.js — motor de conversación LOCAL de Ramiro AI (sin servicios externos).
   Orden de evaluación: charla → entidad mencionada (máquina/parte/cliente) → navegación → cifras y listas → permisos → seguimiento con contexto → no entendí. */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, esc = U.esc;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lev = (a, b) => { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const STOP = new Set('de la el los las un una que quien cual cuales cuantos cuantas en es y o por para con del al me mi mis dime dame muestrame hay esta este ese eso lo le se su sus como donde cuando son estan estado status operador supervisor parte lote turno oee ciclo horas maquina maquinas produccion sesion corriendo inactiva abre abrir lleva llevame ver quiero necesito puedes favor porfa tiene tienen'.split(' '));
  const SECTIONS = [['dashboard', /dashboard|tablero|plant now|panel principal|inicio/], ['production', /production|produccion|estado de maquinas|sesiones/], ['customers', /customers|clientes/], ['parts', /part numbers?|numeros? de parte|partes/], ['machines', /machines|maquinas/], ['catalog', /catalog|catalogo/], ['registers', /registers|registros/], ['personnel', /personnel|personal|operadores/], ['settings', /settings|ajustes|configuracion|turnos|shifts/]];
  const TITLES = { dashboard: 'Dashboard', production: 'Production', customers: 'Customers', parts: 'Part Numbers', machines: 'Machines', catalog: 'Catalog', registers: 'Registers', personnel: 'Personnel', settings: 'Settings' };

  /* ---------- Instantánea de datos (sesiones frescas; resto con caché corta) ---------- */
  let snapP = null, snapAt = 0;
  async function topLists(db) {
    const from = U.ymd(U.addDays(new Date(), -30));
    const [se, de] = await Promise.all([db.select('scrap_events', { embed: ['scrap_catalog', 'production_captures'] }), db.select('downtime_events', { embed: ['downtime_catalog', 'production_captures'] })]);
    const agg = (rows, lab, val, filt) => { const m = {}; rows.filter((r) => r.production_captures && r.production_captures.production_date >= from && (!filt || filt(r))).forEach((r) => { const k = lab(r); m[k] = (m[k] || 0) + val(r); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    return { defect: agg(se, (r) => (r.scrap_catalog ? `${r.scrap_catalog.code} — ${r.scrap_catalog.defect}` : '—'), (r) => r.quantity), down: agg(de, (r) => (r.downtime_catalog ? r.downtime_catalog.downtime : '—'), (r) => r.minutes, (r) => r.event_type === 'Unplanned') };
  }
  async function snap(force) {
    if (!force && snapP && Date.now() - snapAt < 15000) return snapP;
    snapAt = Date.now();
    snapP = (async () => {
      const db = G.db, m = await G.Cache.master(), cat = await G.Cache.catalogs();
      const sessions = await db.select('machine_production_sessions', { where: { status: 'RUNNING' }, embed: ['machines', 'shifts', 'customers', 'part_numbers', 'operations', 'operator', 'supervisor'] });
      const caps = sessions.length ? await db.select('production_captures', { where: { session_id: sessions.map((s) => s.id), hour_slot: { isnull: false } } }) : [];
      const safe = async (fn) => { try { return await fn(); } catch (e) { return null; } };
      const [live, month, today, plant, top] = await Promise.all([safe(() => G.Calc.liveMachines()), safe(() => G.Calc.summary({ period: 'month' })), safe(() => G.Calc.summary({ period: 'today' })), safe(() => G.Calc.plantLive()), safe(() => topLists(db))]);
      const now = new Date();
      const missing = sessions.map((s) => { const hs = G.Shift.hours(s.shifts, s.started_at, now).slots.filter((sl) => sl.end <= now && !caps.some((c) => c.session_id === s.id && c.hour_slot === sl.key)); return { s, n: hs.length }; }).filter((x) => x.n);
      return { m, cat, sessions, caps, live: live || [], month, today, plant, top, missing };
    })();
    return snapP;
  }
  G.bus.on('db:change', () => { snapP = null; });

  const T = () => G.Targets.get();
  const nameOf = (p) => (p ? `${p.first_name} ${p.last_name}` : null);
  const lnk = (mach) => `<a data-m="${esc(mach.id)}" data-go="production/${esc(mach.id)}">${esc(mach.code)}</a>`;
  const stateLabel = (st) => ({ run: 'corriendo en objetivo', watch: 'corriendo por debajo del objetivo', idle: 'inactiva' }[st] || st);

  const Brain = (G.RamiroBrain = {
    sectionChips() {
      const id = G.Router && G.Router.id, L = G.L;
      const m = { dashboard: [L('Dame un resumen', 'Give me a summary'), L('¿Cuál es el OEE de planta?', 'What is the plant OEE?'), L('¿Qué máquinas están bajo objetivo?', 'Which machines are below target?')], production: [L('¿Qué máquinas están corriendo?', 'Which machines are running?'), L('Pendientes', 'Pending'), L('¿Qué puedo hacer aquí?', 'What can I do here?')], registers: [L('¿Cuál es el defecto principal?', 'What is the top defect?'), L('¿Cuál es el paro principal?', 'What is the top downtime?')], parts: [L('¿Cuántos números de parte hay?', 'How many part numbers are there?'), L('Busca ACM-BRK-1001', 'Find ACM-BRK-1001')], machines: [L('¿Qué máquinas hay?', 'Which machines are there?'), L('¿Qué corre en PRS-02?', 'What is running on PRS-02?')], settings: [L('¿Qué permisos tengo?', 'What permissions do I have?'), L('¿Qué puede cada rol?', 'What can each role do?')] };
      return m[id] || [L('Dame un resumen', 'Give me a summary'), L('Pendientes', 'Pending'), L('¿Qué puedes hacer?', 'What can you do?')];
    },
    async insights() {
      const s = await snap(), run = s.live.filter((x) => x.session).length, idle = s.live.length - run, below = s.live.filter((x) => x.state === 'watch').length, miss = s.missing.reduce((a, x) => a + x.n, 0);
      const oee = s.month && s.month.oee, tg = T().oee, L = G.L, td = s.top && s.top.defect[0];
      return [
        ['production', L(`${run} máquinas en producción`, `${run} machines running`), L(`${idle} inactivas${below ? ` · ${below} bajo objetivo` : ''}.`, `${idle} idle${below ? ` · ${below} below target` : ''}.`)],
        ['dashboard', oee != null ? L(`OEE del mes: ${U.pct(oee)}`, `OEE this month: ${U.pct(oee)}`) : L('Dashboard listo', 'Dashboard ready'), oee != null ? (oee >= tg ? L(`Por encima de tu objetivo (${U.pct(tg, 0)}). Buen trabajo.`, `Above your target (${U.pct(tg, 0)}). Nice work.`) : L(`Tu objetivo es ${U.pct(tg, 0)}; hay margen de mejora.`, `Your target is ${U.pct(tg, 0)}; there is room to improve.`)) : L('Revisa las pestañas de OEE, calidad y paros.', 'Check the OEE, quality and downtime tabs.')],
        [td ? 'registers' : 'production', miss ? L(`${miss} hora${miss > 1 ? 's' : ''} sin capturar`, `${miss} hour${miss > 1 ? 's' : ''} not logged`) : td ? L('Defecto principal (30 d)', 'Top defect (30 d)') : L('Todo capturado', 'All logged'), miss ? L('Hay sesiones con horas vencidas en Real Time.', 'Some sessions have overdue hours in Real Time.') : td ? `${s.top.defect[0][0]} (${U.fmtNum(s.top.defect[0][1])} ${L('pzas', 'pcs')}).` : L('No hay horas pendientes por registrar.', 'No pending hours to log.')]
      ];
    },
    /* ---------- Búsqueda de entidades ---------- */
    findMachine(nq, s) {
      const c = nq.match(/\b(prs|cnc|inj)\s*-?\s*(\d{1,2})\b/);
      if (c) { const code = `${c[1].toUpperCase()}-${c[2].padStart(2, '0')}`; const x = s.m.machines.find((mm) => mm.code === code); if (x) return [x]; }
      const fam = /\b(prensas?|press)\b/.test(nq) ? 'PRS' : /\b(cnc|maquinado)\b/.test(nq) ? 'CNC' : /\b(inyeccion|inyectoras?)\b/.test(nq) ? 'INJ' : null;
      if (fam && !c) return s.m.machines.filter((mm) => mm.code.startsWith(fam));
      return [];
    },
    findPart(nq, s) {
      const c = nq.match(/[a-z]{3}-[a-z]{3}-\d{3,4}/); if (c) { const p = s.m.part_numbers.find((x) => U.norm(x.part_number) === c[0]); if (p) return [p]; }
      const toks = nq.split(' ').filter((w) => w.length >= 4 && !STOP.has(w)); if (!toks.length) return [];
      const sc = s.m.part_numbers.map((p) => { const hay = U.norm(`${p.part_number} ${p.description}`).split(/[^a-z0-9]+/); let n = 0; toks.forEach((w) => { if (hay.some((h) => h === w || (w.length >= 5 && h.startsWith(w)) || (w.length >= 5 && lev(w, h) <= 1))) n++; }); return { p, n }; }).filter((x) => x.n).sort((a, b) => b.n - a.n);
      if (!sc.length || sc[0].n < Math.ceil(toks.length / 2)) return []; return sc.filter((x) => x.n === sc[0].n).slice(0, 4).map((x) => x.p);
    },

    /* ---------- Cerebro ---------- */
    async reply(q) {
      if (G.lang !== 'es' && Brain.replyEN) return Brain.replyEN(q);
      const s = await snap(), first = (G.user && G.user.name) || 'amigo', ctx = G.Ramiro.ctx, m = s.m;
      const nq = U.norm(q).replace(/[¿?¡!.,;:()"]/g, ' ').replace(/\s+/g, ' ').trim(), has = (re) => re.test(nq);
      const R = (html, chips, after) => ({ html, chips: chips || [], after });
      const h = new Date().getHours(), part = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
      const live = s.live, running = live.filter((x) => x.session), below = live.filter((x) => x.state === 'watch'), idle = live.filter((x) => !x.session);
      const go = (p) => () => G.Router.go(p);

      /* 1 · Charla */
      if (has(/^(hola|holi|hey|ey|buenas|buenos dias|buenas tardes|buenas noches|que onda|que tal|hello|hi|saludos|ola)\b/)) return R(pick([`¡Hola, ${esc(first)}! 🐶 ${part}. ¿Qué quieres saber de la planta?`, `¡Hola! Qué gusto verte, ${esc(first)}. ¿Revisamos el OEE?`, `${part}, ${esc(first)} ✨ Aquí estoy con la cola moviéndose.`]), this.sectionChips());
      if (has(/como estas|como andas|como te va|como amaneciste/)) return R('¡Muy bien, gracias! Cuidando tus máquinas 🐾 ¿Y tú, qué tal el turno?', ['Dame un resumen']);
      if (has(/gracias|thank|genial|perfecto|excelente|buen trabajo/)) return R(pick(['¡Con gusto! Para eso estoy 🐾', `De nada, ${esc(first)}. Aquí sigo por si necesitas algo más.`]), ['¿Qué puedes hacer?']);
      if (has(/adios|hasta luego|nos vemos|bye|chao/)) return R(`¡Hasta pronto, ${esc(first)}! Yo me quedo vigilando la planta 🐶`);
      if (has(/quien eres|como te llamas|tu nombre|que eres|eres una ia/)) return R('Soy <b>Ramiro AI</b>, el asistente de <b>GUVEL Operational</b>. Conozco tus máquinas, sesiones de producción, OEE, scrap y paros, y te llevo a donde necesites. Trabajo aquí mismo con los datos de este equipo.', ['¿Qué puedes hacer?']);
      if (has(/chiste|algo gracioso/)) return R(pick(['¿Por qué el OEE fue al psicólogo? Porque tenía problemas de disponibilidad 😅', 'Una prensa sin mantenimiento es como un perro sin paseo: tarde o temprano hace ruido 🐕']));
      if (has(/que hora|que dia es|que fecha|fecha de hoy/)) return R('Hoy es ' + new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.');
      if (has(/que puedes|que sabes|ayuda|ayudame|para que sirves|opciones/)) return R('Puedo ayudarte con:<br>• <b>Máquinas</b>: estado, parte, lote, operador, OEE de la sesión<br>• <b>Números de parte</b>: operaciones, máquinas, costos<br>• <b>Cifras</b>: OEE de planta, producción, scrap, paros, defecto principal<br>• <b>Pendientes</b>: horas sin capturar en Real Time<br>• <b>Permisos</b> de cada rol y <b>navegación</b> a cualquier sección', ['¿Qué máquinas están corriendo?', 'Dame un resumen', '¿Qué permisos tengo?']);

      /* 2 · Entidad mencionada */
      const machines = this.findMachine(nq, s);
      if (machines.length === 1) return this.aboutMachine(machines[0], nq, s, { has, R, go });
      if (machines.length > 1 && has(/maquinas|prensas|cnc|inyec|press|lista|cuales|que hay/)) return R(`Hay <b>${machines.length}</b>:<br>${machines.map((x) => { const l = live.find((y) => y.machine.id === x.id); return `${lnk(x)} · ${esc(x.name)} — ${l && l.session ? 'en sesión' : 'inactiva'}`; }).join('<br>')}`, [`¿Qué corre en ${machines[0].code}?`]);
      const parts = this.findPart(nq, s);
      if (parts.length === 1) return this.aboutPart(parts[0], nq, s, { has, R, go });
      if (parts.length > 1) return R(`Encontré varios:<br>${parts.map((p) => `<a data-p="${esc(p.id)}">${esc(p.part_number)}</a> · ${esc(p.description || '')}`).join('<br>')}<br>¿De cuál hablamos?`, parts.slice(0, 3).map((p) => p.part_number));
      const cust = m.customers.find((c) => nq.split(' ').some((w) => w.length >= 3 && (U.norm(c.code) === w || U.norm(c.name).split(' ')[0] === w)));
      if (cust) { const ps = m.part_numbers.filter((p) => p.customer_id === cust.id); return R(`<b>${esc(cust.name)}</b> (${esc(cust.code)}) tiene <b>${ps.length}</b> número${ps.length === 1 ? '' : 's'} de parte:<br>${ps.map((p) => esc(p.part_number)).join(', ')}.`, ['Dame un resumen']); }

      /* 3 · Navegación */
      if (has(/\b(llevame|lleva me|ir a|ve a|vamos a|abre|abrir|quiero ver|muestrame|ensename|navega)\b/)) {
        const sec = SECTIONS.find((x) => x[1].test(nq));
        if (sec) return R(`Listo, te llevo a <b>${TITLES[sec[0]]}</b> ✨${G.can('capture') || sec[0] === 'dashboard' ? '' : ' (con tu rol es de solo lectura 🔒)'}`, [], go(sec[0]));
      }
      if (has(/donde estoy|que es esta pantalla|que veo aqui/)) { const id = G.Router && G.Router.id, info = { dashboard: 'tus KPI de OEE, calidad y paros, y Plant Now con el estado en vivo.', production: 'el estado de cada máquina; ahí inicias producción, capturas hora por hora y cierras sesiones.', registers: 'todos los registros de producción, scrap y paros; puedes exportarlos a CSV.', parts: 'los números de parte con sus operaciones, máquinas, defectos y código de barras.', machines: 'tus máquinas y las partes que puede correr cada una.', catalog: 'los defectos de scrap y las razones de paro.', settings: 'los turnos y tus preferencias.' }; return R(`Estás en <b>${esc(TITLES[id] || 'GUVEL Operational')}</b>${info[id] ? ': ' + info[id] : '.'}`, this.sectionChips()); }

      /* 4 · Cifras y listas */
      const noData = () => R('Todavía no tengo esa cifra 🐾 Abre el <a data-go="dashboard">Dashboard</a> para verla.', ['Dame un resumen']);
      if (has(/cuantas? maquinas|que maquinas (estan|hay)|maquinas (corriendo|activas|en produccion|inactivas|paradas|idle)|estado de (la )?planta|maquinas bajo|bajo (el )?objetivo|below/)) {
        if (!live.length) return noData();
        if (has(/bajo|below|debajo/)) return R(below.length ? `<b>${below.length}</b> bajo objetivo (${U.pct(T().oee, 0)}):<br>${below.map((x) => `${lnk(x.machine)} · OEE ${U.pct(x.oee)}`).join('<br>')}` : 'Ninguna máquina está bajo objetivo ahora mismo 🎉', ['¿Qué máquinas están corriendo?']);
        if (has(/inactiv|parad|idle/)) return R(`<b>${idle.length}</b> inactivas:<br>${idle.map((x) => lnk(x.machine)).join(', ') || '—'}`, ['¿Qué máquinas están corriendo?']);
        return R(`Hay <b>${running.length}</b> corriendo y <b>${idle.length}</b> inactivas de ${live.length}.<br>${running.map((x) => `${lnk(x.machine)} · ${esc((x.session.part_numbers || {}).part_number || '')} · OEE ${U.pct(x.oee)}`).join('<br>')}`, below.length ? ['¿Qué máquinas están bajo objetivo?'] : ['Dame un resumen']);
      }
      if (has(/\boee\b|eficiencia|disponibilidad|rendimiento|calidad de planta/)) {
        const mo = s.month, tg = T(); if (!mo || mo.oee == null) return noData();
        return R(`OEE de planta este mes: <b>${U.pct(mo.oee)}</b> (objetivo ${U.pct(tg.oee, 0)}).<br>Availability ${U.pct(mo.a)} · Performance ${U.pct(mo.p)} · Quality ${U.pct(mo.q)}.${s.plant && s.plant.oee != null ? `<br>En vivo (sesiones activas): <b>${U.pct(s.plant.oee)}</b>.` : ''}`, ['¿Qué máquinas están bajo objetivo?', 'Dame un resumen']);
      }
      if (has(/defecto principal|mas scrap|principal defecto|top defecto|pareto de scrap/)) { const d = s.top && s.top.defect; return d && d[0] ? R(`En los últimos 30 días el defecto principal es <b>${esc(d[0][0])}</b> con ${U.fmtNum(d[0][1])} piezas.${d[1] ? `<br>Le sigue ${esc(d[1][0])} (${U.fmtNum(d[1][1])}).` : ''}`, ['¿Cuál es el paro principal?']) : noData(); }
      if (has(/paro principal|mas paros|principal paro|principal causa de paro|top paro/)) { const d = s.top && s.top.down; return d && d[0] ? R(`En los últimos 30 días el paro no planeado principal es <b>${esc(d[0][0])}</b> con ${U.fmtNum(d[0][1])} min.${d[1] ? `<br>Le sigue ${esc(d[1][0])} (${U.fmtNum(d[1][1])} min).` : ''}`, ['¿Cuál es el defecto principal?']) : noData(); }
      if (has(/cuantos? (numeros? de parte|partes)|cuantos clientes|cuantas operaciones/)) return R(`Hay <b>${m.part_numbers.length}</b> números de parte, <b>${m.customers.length}</b> clientes y <b>${m.operations.length}</b> operaciones.`, ['Busca ACM-BRK-1001']);
      if (has(/produccion de hoy|cuanto (se )?(produjo|produjimos)|piezas (de )?hoy|hoy/) && has(/produc|piezas|hoy/) && !has(/pendient/)) { const t = s.today; return t && t.total ? R(`Hoy van <b>${U.fmtNum(t.total)}</b> piezas producidas (${U.fmtNum(t.good)} buenas, ${U.fmtNum(t.scrap)} scrap).`, ['Dame un resumen']) : R('Hoy todavía no hay capturas finales registradas; las horas de Real Time se consolidan al terminar la sesión 🐾', ['¿Qué máquinas están corriendo?']); }
      if (has(/pendient|por capturar|sin capturar|horas vencidas|que me toca/)) {
        if (!s.missing.length) return R('No tienes horas pendientes por capturar. ¡Buen trabajo! 🎉', ['Dame un resumen']);
        return R(`Hay horas sin capturar en Real Time:<br>${s.missing.map((x) => `${lnk(x.s.machines)} · <b>${x.n}</b> hora${x.n > 1 ? 's' : ''}`).join('<br>')}`, [`¿Qué corre en ${s.missing[0].s.machines.code}?`]);
      }
      if (has(/resumen|panorama|como va todo|novedades/)) {
        const mo = s.month, miss = s.missing.reduce((a, x) => a + x.n, 0);
        return R(`Resumen de hoy, ${esc(first)}:<br>• <b>${running.length}</b> máquinas corriendo, ${below.length} bajo objetivo, ${idle.length} inactivas<br>${mo && mo.oee != null ? `• OEE del mes <b>${U.pct(mo.oee)}</b> (objetivo ${U.pct(T().oee, 0)})<br>` : ''}• ${miss ? `<a data-go="production">${miss} hora${miss > 1 ? 's' : ''} sin capturar</a>` : 'Sin horas pendientes de captura'}${s.top && s.top.defect[0] ? `<br>• Defecto principal: ${esc(s.top.defect[0][0])}` : ''}`, ['Pendientes', '¿Cuál es el OEE de planta?']);
      }

      /* 5 · Permisos */
      if (has(/permiso|\bpuedo\b|que roles?\b|que puede\b|\brol(es)?\b/)) {
        const role = G.user.role, p = G.PERMS[role], ok = (k) => (p[k] ? '✅' : '❌');
        if (has(/cada rol|roles/) && !has(/\bmis\b|\btengo\b/)) return R('Cinco roles:<br>• <b>owner / admin</b>: todo<br>• <b>manager</b>: captura, maestros, personal y borrar registros (sin Settings)<br>• <b>supervisor</b>: captura y exportar<br>• <b>guest</b>: solo ver<br><small>(matriz propuesta, pendiente de validar con RLS)</small>', ['¿Qué permisos tengo?']);
        return R(`Eres <b>${esc(role)}</b>:<br>${ok('capture')} Iniciar sesiones y capturar<br>${ok('masters')} Editar maestros y catálogos<br>${ok('deleteRegisters')} Borrar en Registers<br>${ok('export')} Exportar CSV<br>${ok('settings')} Editar turnos`, ['¿Qué puede cada rol?']);
      }
      if (has(/inicia|iniciar|empieza|arranca|termina|terminar|cierra|captura/) && has(/produccion|sesion|hora|real time/)) return G.can('capture') ? R('Entra a <a data-go="production">Production</a>, elige la máquina y ahí inicias la sesión, capturas hora por hora (Real Time) y la cierras con Finish Session 🐾', [], null) : R(`Con tu rol (${esc(G.user.role)}) no puedes capturar producción 🔒. Pídele a un supervisor o manager que lo haga.`);

      /* 6 · Seguimiento con contexto */
      const short = nq.split(' ').length <= 6, follow = (re) => has(/operador|supervisor|lote|oee|horas capturadas|turno|como va|estado/) || (short && re.test(nq));
      if (ctx.machine && m.byId.machines[ctx.machine] && follow(/\b(y|lo|su|sus|ese|esa|eso)\b/)) return this.aboutMachine(m.byId.machines[ctx.machine], nq, s, { has, R, go });
      if (ctx.part && m.byId.part_numbers[ctx.part] && (has(/operaciones|costo|cuesta|de que cliente/) || (short && /\b(y|lo|su|sus|ese|esa|eso)\b/.test(nq)))) return this.aboutPart(m.byId.part_numbers[ctx.part], nq, s, { has, R, go });

      /* 7 · No entendí */
      const words = nq.split(' ').filter((w) => w.length >= 5 && !STOP.has(w)); let best = null;
      m.part_numbers.forEach((p) => U.norm(p.part_number + ' ' + p.description).split(/[^a-z0-9]+/).forEach((hw) => words.forEach((w) => { const d = lev(w, hw); if (hw.length >= 4 && d <= 2 && (!best || d < best.d)) best = { p, d }; })));
      if (best) return R(`No estoy segura… ¿te refieres a <a data-p="${esc(best.p.id)}">${esc(best.p.part_number)}</a> · ${esc(best.p.description || '')}?`, [best.p.part_number]);
      return R('Mmm, de eso no sé todavía 🐾 Prueba con una máquina (“PRS-02”), un número de parte, o pregúntame por “OEE”, “pendientes”, “defecto principal” o “¿qué puedes hacer?”.', ['¿Qué puedes hacer?', 'Dame un resumen']);
    },

    async aboutMachine(mach, nq, s, k) {
      const { has, R, go } = k, l = s.live.find((x) => x.machine.id === mach.id), sess = l && l.session; G.Ramiro.ctx.machine = mach.id;
      const nextQ = [`¿Quién opera la ${mach.code}?`, `¿Cuál es el OEE de la ${mach.code}?`, `Abre ${mach.code}`];
      if (has(/abre|abrir|llevame|ir a/)) return R(`Abriendo ${lnk(mach)} en Production ✨`, [], go('production/' + mach.id));
      if (has(/como va|salud|analiza|que tal va/)) {   // salud de la máquina en el mes (OEE, disponibilidad, scrap, paros)
        const sm = await G.Calc.summary({ period: 'month', machineId: mach.id }).catch(() => null), tg = T();
        if (sm && sm.total) { const top = sm.scrapByDefect[0], dn = sm.downByReason[0], st = G.statusVsTarget(sm.oee, tg.oee); return R(`${lnk(mach)} este mes: OEE <b>${U.pct(sm.oee)}</b> (${st.label}, objetivo ${U.pct(tg.oee, 0)}).<br>Disponibilidad ${U.pct(sm.a, 0)} · Performance ${U.pct(sm.p, 0)} · Calidad ${U.pct(sm.q, 1)}<br>${U.fmtNum(sm.downMin)} min de paro${dn ? ` (sobre todo <i>${esc(dn.label)}</i>)` : ''} · scrap ${U.pct(sm.scrapRate, 2)}${top ? `, principal defecto <i>${esc(top.label)}</i>` : ''}.${sess ? '' : '<br>Ahora está inactiva.'}`, nextQ); }
      }
      const linked = s.m.links.filter((x) => x.machine_id === mach.id).map((x) => s.m.byId.part_numbers[x.part_number_id]).filter(Boolean);
      if (has(/puede correr|vinculad|numeros? de parte|que partes/)) return R(`${lnk(mach)} puede correr: ${linked.map((p) => esc(p.part_number)).join(', ') || 'ninguna parte vinculada'}.`, nextQ);
      if (!sess) return R(`${lnk(mach)} (${esc(mach.name)}) está <b>inactiva</b>, sin sesión de producción.${G.can('capture') ? ' Puedes iniciar una desde <a data-go="production/' + esc(mach.id) + '">Production</a>.' : ''}`, [`¿Qué puede correr la ${mach.code}?`]);
      const sx = sess, cnt = s.caps.filter((c) => c.session_id === sx.id).length;
      if (has(/operador|opera|quien trabaja/)) return R(`<b>${esc(nameOf(sx.operator) || 'Sin operador asignado')}</b> opera ${lnk(mach)}${sx.supervisor ? `; supervisa ${esc(nameOf(sx.supervisor))}` : ''}.`, nextQ);
      if (has(/supervisor|supervisa/)) return R(`${esc(nameOf(sx.supervisor) || 'Nadie')} supervisa ${lnk(mach)}.`, nextQ);
      if (has(/lote/)) return R(`El lote de ${lnk(mach)} es <b>${esc(sx.lot_number)}</b>.`, nextQ);
      if (has(/turno/)) return R(`${lnk(mach)} corre en <b>${esc(sx.shifts.name)}</b> (${esc(G.Shift.windowLabel(sx.shifts))}).`, nextQ);
      if (has(/\boee\b|eficiencia|disponibilidad|rendimiento|calidad/)) return R(l.oee != null ? `Session OEE de ${lnk(mach)}: <b>${U.pct(l.oee)}</b><br>Availability ${U.pct(l.a)} · Performance ${U.pct(l.p)} · Quality ${U.pct(l.q)}<br>Objetivo OEE ${U.pct(T().oee, 0)}. ${G.statusVsTarget(l.oee, T().oee).label}.` : `${lnk(mach)} todavía no tiene horas capturadas para calcular el OEE de la sesión.`, nextQ);
      if (has(/horas|real time|capturad/)) return R(`${lnk(mach)} lleva <b>${cnt}</b> hora${cnt === 1 ? '' : 's'} capturada${cnt === 1 ? '' : 's'} en Real Time.`, nextQ);
      const op = sx.operations;
      return R(`${lnk(mach)} · <b>${esc(l.state === 'watch' ? 'bajo objetivo' : 'corriendo')}</b><br>${esc(sx.part_numbers.part_number)}${op ? ` · Op ${op.operation_number} ${esc(op.operation_name)}` : ''}<br>Cliente ${esc(sx.customers.name)} · Lote ${esc(sx.lot_number)}<br>${l.oee != null ? `Session OEE <b>${U.pct(l.oee)}</b> · ` : ''}${cnt} h capturadas`, nextQ);
    },
    async aboutPart(p, nq, s, k) {
      const { has, R } = k; G.Ramiro.ctx.part = p.id;
      const ops = s.m.operations.filter((o) => o.part_number_id === p.id).sort((a, b) => a.operation_number - b.operation_number);
      const mach = s.m.links.filter((x) => x.part_number_id === p.id).map((x) => s.m.byId.machines[x.machine_id]).filter(Boolean);
      const cust = s.m.byId.customers[p.customer_id], runningOn = s.sessions.filter((x) => x.part_number_id === p.id).map((x) => x.machines);
      const nextQ = [`¿Qué operaciones tiene ${p.part_number}?`, `¿En qué máquinas corre ${p.part_number}?`];
      if (has(/scrap|defecto|desecho|rank/)) {
        const sm = await G.Calc.summary({ period: 'month', partNumberId: p.id }).catch(() => null);
        if (!sm || !sm.scrap) return R(`${esc(p.part_number)} no registra scrap este mes 🎉`, nextQ);
        const d = sm.scrapByDefect.slice(0, 3);
        return R(`Scrap de <b>${esc(p.part_number)}</b> este mes: <b>${U.fmtNum(sm.scrap)}</b> piezas (${U.pct(sm.scrapRate, 2)} de lo producido).<br>${d.map((x, i) => `Rank ${i + 1}: ${esc(x.label)} — ${U.fmtNum(x.qty)} (${U.pct(x.qty / sm.scrap, 0)})`).join('<br>')}<br>Costo del scrap: <b>${U.money(sm.scrap * (Number(p.scrap_cost) || 0))}</b>.`, nextQ);
      }
      if (has(/operacion|ciclo/)) return R(`${esc(p.part_number)} tiene <b>${ops.length}</b> operaciones:<br>${ops.map((o) => `${o.operation_number} · ${esc(o.operation_name)} — ${o.ideal_cycle_time_seconds} s`).join('<br>')}`, nextQ.slice(1));
      if (has(/maquina|corre|donde/)) return R(`${esc(p.part_number)} se puede correr en: ${mach.map(lnk).join(', ') || 'ninguna máquina vinculada'}.${runningOn.length ? `<br>Ahora corre en ${runningOn.map(lnk).join(', ')}.` : ''}`, nextQ.slice(0, 1));
      if (has(/costo|precio|cuesta|vale/)) return R(`${esc(p.part_number)}: pieza <b>${U.money(p.piece_cost)}</b> · scrap <b>${U.money(p.scrap_cost)}</b>.`, nextQ);
      if (has(/cliente|de quien/)) return R(`${esc(p.part_number)} es de <b>${esc(cust ? cust.name : '—')}</b>.`, nextQ);
      return R(`<a data-p="${esc(p.id)}" data-go="parts">${esc(p.part_number)}</a> · ${esc(p.description || '')}<br>Cliente: ${esc(cust ? cust.name : '—')} · ${ops.length} operaciones · ${mach.length} máquinas<br>Pieza ${U.money(p.piece_cost)} · scrap ${U.money(p.scrap_cost)}${runningOn.length ? `<br>Corriendo ahora en ${runningOn.map(lnk).join(', ')}` : ''}`, nextQ);
    }
  });
  Brain._snap = snap; Brain._T = T; Brain._lnk = lnk; Brain._nameOf = nameOf; Brain._lev = lev;
})();
