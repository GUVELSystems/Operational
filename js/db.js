/* db.js — capa de datos aislada. La UI NUNCA toca los arreglos; todo pasa por G.db.
   Cada método indica la consulta de Supabase que lo reemplaza.
   - select(table, opts)  ≈ supabase.from(table).select('*, machines(*), ...').eq('company_id', cid).order(...)
   - insert / update / delete ≈ .insert() / .update().eq('id') / .delete().eq('id')
   - startSession, saveHour, deleteHour, finishSessionSingle, consolidateAndFinish, deleteCapture
       ≈ funciones de base de datos (RPC) transaccionales: supabase.rpc('fn_...')                         */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U;
  const LS_KEY = 'guvel_db_v1', SEED_VER = 3;
  const TABLES = ['companies', 'customers', 'part_numbers', 'machines', 'part_number_machines', 'operations', 'operation_machine_cycle_times', 'shifts', 'personnel', 'scrap_catalog', 'downtime_catalog', 'machine_production_sessions', 'production_captures', 'scrap_events', 'downtime_events', 'notices', 'memberships', 'invitations'];
  // FK → tabla destino (los embeds se resuelven como objetos anidados con el nombre de la tabla en plural)
  const FK = {
    part_numbers: { customer_id: 'customers' },
    part_number_machines: { part_number_id: 'part_numbers', machine_id: 'machines' },
    operations: { part_number_id: 'part_numbers' },
    operation_machine_cycle_times: { operation_id: 'operations', part_number_id: 'part_numbers', machine_id: 'machines' },
    scrap_catalog: { part_number_id: 'part_numbers', operation_id: 'operations' },
    machine_production_sessions: { machine_id: 'machines', shift_id: 'shifts', customer_id: 'customers', part_number_id: 'part_numbers', operation_id: 'operations', operator_id: 'personnel', supervisor_id: 'personnel' },
    production_captures: { shift_id: 'shifts', customer_id: 'customers', part_number_id: 'part_numbers', machine_id: 'machines', operation_id: 'operations', session_id: 'machine_production_sessions' },
    scrap_events: { production_capture_id: 'production_captures', scrap_catalog_id: 'scrap_catalog' },
    downtime_events: { production_capture_id: 'production_captures', downtime_catalog_id: 'downtime_catalog' }
  };
  const ALIAS = { operator: ['operator_id', 'personnel'], supervisor: ['supervisor_id', 'personnel'] };
  // Dependientes que se borran en cascada
  const CASCADE = {
    customers: [], part_numbers: ['operations', 'part_number_machines', 'operation_machine_cycle_times', 'scrap_catalog'],
    operations: ['operation_machine_cycle_times', 'scrap_catalog'], machines: ['part_number_machines', 'operation_machine_cycle_times'],
    production_captures: ['scrap_events', 'downtime_events'], scrap_catalog: [], downtime_catalog: [], shifts: [], personnel: []
  };
  const FRIENDLY = { customers: 'customer', part_numbers: 'part number', machines: 'machine', shifts: 'shift', personnel: 'person', scrap_catalog: 'scrap defect', downtime_catalog: 'downtime reason', operations: 'operation' };
  const fail = (msg, code) => { const e = new Error(msg); e.code = code || 'ERR'; return e; };

  class DB {
    constructor() { this.data = null; this.companyId = null; this.latency = true; this._t = 0; }

    /* ---------- ciclo de vida ---------- */
    async init() {
      let d = null;
      try { const raw = localStorage.getItem(LS_KEY); if (raw) { d = JSON.parse(raw); if (!d || d.__v !== SEED_VER) d = null; } } catch (e) { d = null; }
      this.data = d || G.buildSeed(); this.data.__v = SEED_VER;
      this.companyId = null;                                     // multi-empresa: la empresa activa la fija G.Tenant (por subdominio) con setCompany()
      this._migrate(); if (!d) this._save();
    }
    /** Migraciones idempotentes: tabla notices, campos de empresa (slug/status) y membresías */
    _migrate() {
      const demo = this.data.companies[0];
      if (!this.data.notices) this.data.notices = G.buildNotices(demo.id);
      if (!this.data.invitations) this.data.invitations = [];
      if (G.Tenant) G.Tenant.seedTenants(this.data);
      this._save();
    }
    /** Fija la empresa activa. Supabase: la empresa sale de la membresía del JWT (RLS), no de un valor que el cliente pueda cambiar. */
    setCompany(id) {
      const c = this.data.companies.find((x) => x.id === id); if (!c) throw fail('Company not found.', 'COMPANY_NOT_FOUND');
      if (c.status !== 'active') throw fail('This workspace is not active.', 'COMPANY_INACTIVE');
      this.companyId = id; return c;
    }
    _guard() { const c = this.companyId && this.data.companies.find((x) => x.id === this.companyId); if (!c || c.status !== 'active') throw fail('This workspace is not active.', 'COMPANY_INACTIVE'); }
    /** Restaura SOLO los datos de la empresa activa (demo); las demás empresas no se tocan */
    reset() {
      const old = this.companyId, slug = this.company().slug, fresh = G.buildSeed();
      Object.keys(this.data).forEach((t) => { if (Array.isArray(this.data[t]) && t !== 'companies' && t !== 'memberships') this.data[t] = this.data[t].filter((r) => r.company_id !== old); });
      const nc = fresh.companies[0]; this.data.companies = this.data.companies.filter((c) => c.id !== old);
      Object.assign(nc, { slug, status: 'active', demo: true }); this.data.companies.unshift(nc);
      Object.keys(fresh).forEach((t) => { if (Array.isArray(fresh[t]) && t !== 'companies') this.data[t] = (this.data[t] || []).concat(fresh[t]); });
      this.data.notices = (this.data.notices || []).concat(G.buildNotices(nc.id));
      (this.data.memberships || []).forEach((m) => { if (m.company_id === old) m.company_id = nc.id; });
      this.companyId = nc.id; this._save();
    }
    _save() { clearTimeout(this._t); this._t = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); } catch (e) { /* cuota o modo privado: seguimos en memoria */ } }, 250); }
    async _lat() { this._guard(); if (this.latency) await new Promise((r) => setTimeout(r, 50 + Math.random() * 100)); this._guard(); }   // toda operación exige empresa activa (Supabase: política RLS con companies.status = 'active')
    /** Toda llave foránea debe apuntar a una fila de LA MISMA empresa (Supabase: FK compuesta (company_id, id)) */
    _checkRefs(table, rows) {
      const map = FK[table]; if (!map) return;
      rows.forEach((r) => Object.keys(map).forEach((col) => { if (r[col] != null && r[col] !== '' && !this._byId(map[col], r[col])) throw fail('A referenced record does not belong to this company.', 'FOREIGN_REFERENCE'); }));
    }
    _rows(t) { return this.data[t].filter((r) => r.company_id === this.companyId); }
    _byId(t, id) { return this.data[t].find((r) => r.id === id && r.company_id === this.companyId); }
    company() { return this.data.companies.find((c) => c.id === this.companyId); }

    /* ---------- embeds ---------- */
    _embed(table, row, embed) {
      if (!embed || !embed.length) return row;
      const out = { ...row };
      embed.forEach((name) => {
        if (ALIAS[name]) { const [col, tgt] = ALIAS[name]; out[name] = row[col] ? this._byId(tgt, row[col]) || null : null; return; }
        const map = FK[table] || {};
        const col = Object.keys(map).find((c) => map[c] === name);
        if (col) out[name] = row[col] ? this._byId(name, row[col]) || null : null;
        else {                                  // relación inversa 1-N: p.ej. part_numbers → operations
          const back = (FK[name] || {});
          const bcol = Object.keys(back).find((c) => back[c] === table);
          if (bcol) out[name] = this._rows(name).filter((r) => r[bcol] === row.id);
        }
      });
      return out;
    }
    /* where: {col: valor | [valores] | fn(valor,row) | {gte,lte,gt,lt,neq,in,isnull}} */
    _match(row, where) {
      for (const k in where) {
        const w = where[k], v = row[k];
        if (typeof w === 'function') { if (!w(v, row)) return false; }
        else if (Array.isArray(w)) { if (!w.includes(v)) return false; }
        else if (w && typeof w === 'object') {
          if ('gte' in w && !(v >= w.gte)) return false; if ('lte' in w && !(v <= w.lte)) return false;
          if ('gt' in w && !(v > w.gt)) return false; if ('lt' in w && !(v < w.lt)) return false;
          if ('neq' in w && v === w.neq) return false; if ('in' in w && !w.in.includes(v)) return false;
          if ('isnull' in w && (v == null) !== w.isnull) return false;
        } else if (v !== w) return false;
      }
      return true;
    }

    /* ---------- lecturas ---------- */
    async select(table, opts = {}) {
      await this._lat();
      let rows = this._rows(table);
      if (opts.where) rows = rows.filter((r) => this._match(r, opts.where));
      if (opts.order) {
        const ord = typeof opts.order === 'string' ? [[opts.order, 'asc']] : opts.order;
        rows = rows.slice().sort((a, b) => { for (const [c, dir] of ord) { const x = a[c], y = b[c]; if (x === y) continue; const s = x == null ? -1 : y == null ? 1 : x < y ? -1 : 1; return dir === 'desc' ? -s : s; } return 0; });
      }
      if (opts.limit) rows = rows.slice(0, opts.limit);
      return rows.map((r) => this._embed(table, r, opts.embed));
    }
    async get(table, id, opts = {}) { await this._lat(); const r = this._byId(table, id); return r ? this._embed(table, r, opts.embed) : null; }
    async count(table, where) { await this._lat(); return this._rows(table).filter((r) => !where || this._match(r, where)).length; }

    /* ---------- escrituras ---------- */
    async insert(table, payload) {
      await this._lat();
      const many = Array.isArray(payload);
      const rows = (many ? payload : [payload]).map((p) => ({ id: U.uid(), ...p, company_id: this.companyId, created_at: new Date().toISOString() }));
      this._checkUnique(table, rows); this._checkRefs(table, rows);
      this.data[table].push(...rows); this._save(); G.bus.emit('db:change', { table });
      return many ? rows : rows[0];
    }
    async update(table, id, patch) {
      await this._lat();
      const r = this._byId(table, id); if (!r) throw fail('That record no longer exists.', 'NOT_FOUND');
      const next = { ...r, ...patch, id: r.id, company_id: r.company_id };
      this._checkUnique(table, [next], id); this._checkRefs(table, [next]);
      Object.assign(r, next); this._save(); G.bus.emit('db:change', { table });
      return { ...r };
    }
    async delete(table, id) { await this._lat(); this._deleteSync(table, id); this._save(); G.bus.emit('db:change', { table }); return true; }
    _checkUnique(table, rows, selfId) {
      const uniq = { machines: ['code', 'machine code'], customers: ['code', 'customer code'], personnel: ['employee_id', 'employee ID'], shifts: ['code', 'shift code'], downtime_catalog: ['code', 'downtime code'] }[table];
      if (uniq) rows.forEach((r) => { const dup = this._rows(table).some((x) => x.id !== (selfId || r.id) && U.norm(x[uniq[0]]) === U.norm(r[uniq[0]])); if (dup) throw fail(`That ${uniq[1]} already exists.`, 'DUPLICATE'); });
      if (table === 'part_numbers') rows.forEach((r) => { if (this._rows(table).some((x) => x.id !== (selfId || r.id) && U.norm(x.part_number) === U.norm(r.part_number))) throw fail('That part number already exists.', 'DUPLICATE'); });
      if (table === 'scrap_catalog') rows.forEach((r) => { const dup = this._rows(table).some((x) => x.id !== (selfId || r.id) && U.norm(x.code) === U.norm(r.code) && (r.part_number_id == null ? x.part_number_id == null : x.part_number_id === r.part_number_id && (x.operation_id || null) === (r.operation_id || null))); if (dup) throw fail('That defect code already exists' + (r.part_number_id == null ? ' as a General defect.' : ' for this operation.'), 'DUPLICATE'); });
      if (table === 'operations') rows.forEach((r) => { if (this._rows(table).some((x) => x.id !== (selfId || r.id) && x.part_number_id === r.part_number_id && String(x.operation_number) === String(r.operation_number))) throw fail('That operation number already exists for this part number.', 'DUPLICATE'); });
    }
    _referencedBy(table, id) {            // referencias que bloquean el borrado (no en cascada)
      const casc = CASCADE[table] || []; let n = 0;
      Object.keys(FK).forEach((t) => { if (casc.includes(t)) return; Object.keys(FK[t]).forEach((c) => { if (FK[t][c] === table) n += this._rows(t).filter((r) => r[c] === id).length; }); });
      return n;
    }
    _deleteSync(table, id) {
      const row = this._byId(table, id); if (!row) return;
      const used = this._referencedBy(table, id);
      if (used) throw fail(`This ${FRIENDLY[table] || 'record'} is used by ${used} other record${used > 1 ? 's' : ''} and cannot be deleted.`, 'IN_USE');
      (CASCADE[table] || []).forEach((t) => { Object.keys(FK[t] || {}).forEach((c) => { if (FK[t][c] === table) this._rows(t).filter((r) => r[c] === id).forEach((r) => this._deleteSync(t, r.id)); }); });
      this.data[table] = this.data[table].filter((r) => r.id !== id);
    }
    /** Borra una captura y en cascada sus scrap/downtime events ≈ DELETE ... ON DELETE CASCADE */
    async deleteCapture(id) {
      await this._lat();
      ['scrap_events', 'downtime_events'].forEach((t) => { this.data[t] = this.data[t].filter((e) => e.production_capture_id !== id); });
      this.data.production_captures = this.data.production_captures.filter((c) => c.id !== id);
      this._save(); G.bus.emit('db:change', { table: 'production_captures' }); return true;
    }

    /* ---------- transaccionales (≈ funciones de base de datos) ---------- */
    _addEvents(capId, scrap, down) {
      const now = new Date().toISOString(), base = { company_id: this.companyId, created_at: now, production_capture_id: capId };
      (scrap || []).forEach((s) => this.data.scrap_events.push({ id: U.uid(), ...base, scrap_catalog_id: s.scrap_catalog_id, quantity: Number(s.quantity) || 0, reason: s.reason || null }));
      (down || []).forEach((d) => this.data.downtime_events.push({ id: U.uid(), ...base, downtime_catalog_id: d.downtime_catalog_id, minutes: Number(d.minutes) || 0, event_type: d.event_type || 'Unplanned', reason: d.reason || null }));
    }
    _dropEvents(capId) { ['scrap_events', 'downtime_events'].forEach((t) => { this.data[t] = this.data[t].filter((e) => e.production_capture_id !== capId); }); }
    _validateEvents(qty, scrap, down) {
      const sc = U.sum(scrap || [], (s) => s.quantity);
      if (sc > qty) throw fail('Scrap cannot exceed the pieces produced.', 'SCRAP_GT_QTY');
    }
    /** ≈ rpc('start_session'): una sola sesión RUNNING por máquina (índice único parcial en Postgres) */
    async startSession(p) {
      await this._lat();
      if (this._rows('machine_production_sessions').some((s) => s.machine_id === p.machine_id && s.status === 'RUNNING')) throw fail('This machine already has an active production session.', 'MACHINE_BUSY');
      const row = { id: U.uid(), company_id: this.companyId, created_at: new Date().toISOString(), ...p, started_at: new Date().toISOString(), finished_at: null, status: 'RUNNING' };
      this.data.machine_production_sessions.push(row); this._save(); G.bus.emit('db:change', { table: 'machine_production_sessions' }); return { ...row };
    }
    /** ≈ rpc('save_hour'): inserta o ACTUALIZA la captura de esa hora y reemplaza sus eventos */
    async saveHour({ session_id, hour_slot, quantity, scrap, downtime }) {
      await this._lat();
      const s = this._byId('machine_production_sessions', session_id); if (!s || s.status !== 'RUNNING') throw fail('This session is no longer active.', 'SESSION_CLOSED');
      quantity = Number(quantity); if (!Number.isInteger(quantity) || quantity < 0) throw fail('Pieces produced must be a whole number, 0 or more.', 'BAD_QTY');
      this._validateEvents(quantity, scrap, downtime);
      const op = s.operator_id ? this._byId('personnel', s.operator_id) : null, sup = s.supervisor_id ? this._byId('personnel', s.supervisor_id) : null;
      const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : null);
      let cap = this._rows('production_captures').find((c) => c.session_id === session_id && c.hour_slot === hour_slot);
      const fields = { production_date: U.ymd(new Date(hour_slot)), captured_at: new Date().toISOString(), shift_id: s.shift_id, lot_number: s.lot_number, customer_id: s.customer_id, part_number_id: s.part_number_id, machine_id: s.machine_id, operation_id: s.operation_id, operator_name: fullName(op), supervisor_name: fullName(sup), production_quantity: quantity, confirmed: true, session_id, hour_slot };
      if (cap) { Object.assign(cap, fields); this._dropEvents(cap.id); }
      else { cap = { id: U.uid(), company_id: this.companyId, created_at: new Date().toISOString(), ...fields }; this.data.production_captures.push(cap); }
      this._addEvents(cap.id, scrap, downtime); this._save(); G.bus.emit('db:change', { table: 'production_captures' }); return { ...cap };
    }
    async deleteHour(session_id, hour_slot) {
      await this._lat();
      const cap = this._rows('production_captures').find((c) => c.session_id === session_id && c.hour_slot === hour_slot);
      if (cap) { this._dropEvents(cap.id); this.data.production_captures = this.data.production_captures.filter((c) => c.id !== cap.id); this._save(); G.bus.emit('db:change', { table: 'production_captures' }); }
      return true;
    }
    _closeSession(s) { s.status = 'COMPLETED'; s.finished_at = new Date().toISOString(); }
    /** ≈ rpc('finish_session_single'): UNA captura final (hour_slot null); borra las horas Real Time si existían */
    async finishSessionSingle(session_id, { production_date, quantity, scrap, downtime }) {
      await this._lat();
      const s = this._byId('machine_production_sessions', session_id); if (!s || s.status !== 'RUNNING') throw fail('This session is no longer active.', 'SESSION_CLOSED');
      quantity = Number(quantity); if (!Number.isInteger(quantity) || quantity < 0) throw fail('Pieces produced must be a whole number, 0 or more.', 'BAD_QTY');
      this._validateEvents(quantity, scrap, downtime);
      this._rows('production_captures').filter((c) => c.session_id === session_id).forEach((c) => { this._dropEvents(c.id); });
      this.data.production_captures = this.data.production_captures.filter((c) => !(c.company_id === this.companyId && c.session_id === session_id));
      const cap = this._finalCapture(s, production_date || U.today(), quantity);
      this._addEvents(cap.id, scrap, downtime); this._closeSession(s); this._save();
      G.bus.emit('db:change', { table: 'production_captures' }); G.bus.emit('db:change', { table: 'machine_production_sessions' }); return { ...cap };
    }
    _finalCapture(s, date, quantity) {
      const op = s.operator_id ? this._byId('personnel', s.operator_id) : null, sup = s.supervisor_id ? this._byId('personnel', s.supervisor_id) : null;
      const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : null);
      const cap = { id: U.uid(), company_id: this.companyId, created_at: new Date().toISOString(), production_date: date, captured_at: new Date().toISOString(), shift_id: s.shift_id, lot_number: s.lot_number, customer_id: s.customer_id, part_number_id: s.part_number_id, machine_id: s.machine_id, operation_id: s.operation_id, operator_name: fullName(op), supervisor_name: fullName(sup), production_quantity: quantity, confirmed: true, session_id: s.id, hour_slot: null };
      this.data.production_captures.push(cap); return cap;
    }
    /** ≈ rpc('consolidate_and_finish'): suma las horas, crea UNA captura final, reasigna eventos, borra las horas y cierra */
    async consolidateAndFinish(session_id) {
      await this._lat();
      const s = this._byId('machine_production_sessions', session_id); if (!s || s.status !== 'RUNNING') throw fail('This session is no longer active.', 'SESSION_CLOSED');
      const hours = this._rows('production_captures').filter((c) => c.session_id === session_id && c.hour_slot);
      if (!hours.length) throw fail('There are no hours to consolidate.', 'NO_HOURS');
      const total = U.sum(hours, (h) => h.production_quantity);
      const date = hours.map((h) => h.production_date).sort()[0];
      const cap = this._finalCapture(s, date, total);
      const ids = new Set(hours.map((h) => h.id));
      ['scrap_events', 'downtime_events'].forEach((t) => this.data[t].forEach((e) => { if (ids.has(e.production_capture_id)) e.production_capture_id = cap.id; }));
      this.data.production_captures = this.data.production_captures.filter((c) => !ids.has(c.id));
      this._closeSession(s); this._save();
      G.bus.emit('db:change', { table: 'production_captures' }); G.bus.emit('db:change', { table: 'machine_production_sessions' }); return { ...cap };
    }
    /** ≈ rpc('cancel_session') */
    async cancelSession(session_id) {
      await this._lat(); const s = this._byId('machine_production_sessions', session_id); if (!s) return false;
      s.status = 'CANCELLED'; s.finished_at = new Date().toISOString(); this._save(); G.bus.emit('db:change', { table: 'machine_production_sessions' }); return true;
    }
  }
  G.db = new DB();
  G.DB_TABLES = TABLES;
})();
