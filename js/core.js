/* core.js — caché de maestros (TTL 60 s), sesión simulada, permisos por rol, preferencias, objetivos (Targets) y escalas de estado */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, db = G.db;

  /* ---------- Caché de datos maestros y catálogos ---------- */
  const TTL = 60000;
  G.Cache = {
    _m: null, _mt: 0, _c: null, _ct: 0,
    /** {customers, part_numbers, machines, shifts, personnel, operations, links, cycle_times, byId:{tabla:{id:fila}}} */
    async master(force) {
      if (!force && this._m && Date.now() - this._mt < TTL) return this._m;
      const [customers, part_numbers, machines, shifts, personnel, operations, links, cycle_times] = await Promise.all([
        db.select('customers', { order: 'code' }), db.select('part_numbers', { order: 'part_number' }), db.select('machines', { order: 'code' }),
        db.select('shifts', { order: 'code' }), db.select('personnel', { order: 'last_name' }), db.select('operations', { order: 'operation_number' }),
        db.select('part_number_machines'), db.select('operation_machine_cycle_times')
      ]);
      const idx = (a) => Object.fromEntries(a.map((r) => [r.id, r]));
      this._m = { customers, part_numbers, machines, shifts, personnel, operations, links, cycle_times, byId: { customers: idx(customers), part_numbers: idx(part_numbers), machines: idx(machines), shifts: idx(shifts), personnel: idx(personnel), operations: idx(operations) } };
      this._mt = Date.now(); return this._m;
    },
    /** {scrap_catalog, downtime_catalog} */
    async catalogs(force) {
      if (!force && this._c && Date.now() - this._ct < TTL) return this._c;
      const [scrap_catalog, downtime_catalog] = await Promise.all([db.select('scrap_catalog', { order: 'code' }), db.select('downtime_catalog', { order: 'code' })]);
      this._c = { scrap_catalog, downtime_catalog }; this._ct = Date.now(); return this._c;
    },
    invalidate() { this._m = null; this._c = null; }
  };
  const MASTER_T = ['customers', 'part_numbers', 'machines', 'shifts', 'personnel', 'operations', 'part_number_machines', 'operation_machine_cycle_times', 'scrap_catalog', 'downtime_catalog'];
  G.bus.on('db:change', ({ table }) => { if (MASTER_T.includes(table)) G.Cache.invalidate(); });
  /** Ciclo ideal (s) para parte+operación+máquina: override por máquina > ideal de la operación */
  G.cycleTime = (m, partId, opId, machineId) => {
    const ov = m.cycle_times.find((c) => c.operation_id === opId && c.machine_id === machineId);
    if (ov) return Number(ov.cycle_time_seconds);
    const o = m.byId.operations[opId]; return o ? Number(o.ideal_cycle_time_seconds) : null;
  };

  /* ---------- Sesión simulada y permisos ---------- */
  const ROLES = (G.ROLES = ['owner', 'admin', 'manager', 'supervisor', 'guest']);
  // Matriz PROPUESTA (a validar contra las políticas RLS reales de Supabase)
  G.PERMS = {
    owner: { view: 1, capture: 1, masters: 1, deleteRegisters: 1, export: 1, targets: 1, settings: 1, personnel: 1, notices: 1, users: 1, companies: 1 },
    admin: { view: 1, capture: 1, masters: 1, deleteRegisters: 1, export: 1, targets: 1, settings: 1, personnel: 1, notices: 1, users: 1, companies: 1 },
    manager: { view: 1, capture: 1, masters: 1, deleteRegisters: 1, export: 1, targets: 1, settings: 0, personnel: 1, notices: 1, users: 0 },
    supervisor: { view: 1, capture: 1, masters: 0, deleteRegisters: 0, export: 1, targets: 1, settings: 0, personnel: 0, notices: 0, users: 0 },
    guest: { view: 1, capture: 0, masters: 0, deleteRegisters: 0, export: 0, targets: 0, settings: 0, personnel: 0, notices: 0, users: 0 }
  };
  G.PERM_LABELS = { users: 'Invite and manage portal users', view: 'View everything', capture: 'Start sessions & capture production', masters: 'Create / edit / delete master data & catalogs', deleteRegisters: 'Delete records in Registers', export: 'Export data (CSV)', targets: 'Edit Plant Now targets', settings: 'Edit Settings (shifts)', personnel: 'Manage Personnel', notices: 'Create, edit and send Notices' };
  G.user = null;
  G.can = (action) => !!(G.user && G.PERMS[G.user.role] && G.PERMS[G.user.role][action]);
  G.Auth = {
    /** Restaura la sesión SOLO si pertenece a la empresa de este subdominio (y, fuera de demo, si la membresía sigue activa) */
    load() {
      try {
        const u = JSON.parse(localStorage.getItem('guvel_user') || 'null');
        if (u && u.email && ROLES.includes(u.role) && u.company_slug && G.Tenant && u.company_slug === G.Tenant.slug) {
          const c = G.db.company(), m = c && !c.demo ? (G.db.data.memberships || []).find((x) => x.company_id === c.id && x.status === 'active' && x.email.toLowerCase() === u.email.toLowerCase()) : null;
          if (c && c.demo) { G.user = u; return u; }
          if (m) { G.user = Object.assign(u, { role: m.role }, m.first_name ? { name: `${m.first_name} ${m.last_name || ''}`.trim() } : {}); return G.user; }   // el rol sale SIEMPRE de la membresía vigente
        }
      } catch (e) { /* sin sesión */ }
      return null;
    },
    login(email, role, companySlug, displayName) {
      const local = String(email || 'user').split('@')[0].split(/[._-]/)[0] || 'user';
      G.user = { email, role: ROLES.includes(role) ? role : 'owner', name: displayName || local.charAt(0).toUpperCase() + local.slice(1), company_slug: companySlug };
      try { localStorage.setItem('guvel_user', JSON.stringify(G.user)); } catch (e) { /* ignora */ } return G.user;
    },
    logout() { G.user = null; try { localStorage.removeItem('guvel_user'); } catch (e) { /* ignora */ } }
  };

  /* ---------- Preferencias ---------- */
  const readLS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignora */ } };
  G.Prefs = {
    s: Object.assign({ reduceMotion: false, live: true, cursor: true }, readLS('guvel_prefs', {})),
    set(k, v) { this.s[k] = v; writeLS('guvel_prefs', this.s); document.documentElement.classList.toggle('reduce-motion', !this.motion()); G.bus.emit('prefs', this.s); },
    motion() { return !this.s.reduceMotion && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); },
    live() { return !!this.s.live; },
    apply() { document.documentElement.classList.toggle('reduce-motion', !this.motion()); }
  };
  G.Prefs.apply();

  /* ---------- Objetivos (Targets) de Plant Now ---------- */
  G.Targets = {
    defaults: { oee: 0.85, availability: 0.90, performance: 0.95, quality: 0.99 },
    get() { return Object.assign({}, this.defaults, readLS('guvel_targets', {})); },
    set(t) { writeLS('guvel_targets', t); G.bus.emit('targets', t); },
    reset() { try { localStorage.removeItem('guvel_targets'); } catch (e) { /* ignora */ } G.bus.emit('targets', this.get()); }
  };

  /* ---------- Escalas de color / estado ---------- */
  G.OEE_THRESH = { stop: 0.70, run: 0.80 };    // anillo/medidor: <70 stop, 70–80 watch, ≥80 run (configurable aquí)
  G.oeeColorKey = (v) => (v == null || !isFinite(v) ? 'idle' : v < G.OEE_THRESH.stop ? 'stop' : v < G.OEE_THRESH.run ? 'watch' : 'run');
  /** Contra objetivo: ≥ objetivo = On track; hasta 10 pts por debajo = Watch; más de 10 pts = Attention; sin dato = neutro */
  G.statusVsTarget = (v, target) => {
    if (v == null || !isFinite(v)) return { key: 'idle', label: '—' };
    if (v >= target) return { key: 'run', label: 'On track' };
    if (target - v <= 0.10) return { key: 'watch', label: 'Watch' };
    return { key: 'stop', label: 'Attention' };
  };
})();

