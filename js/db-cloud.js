/* db-cloud.js — adaptador de G.db para Supabase. Mantiene la MISMA interfaz que db.js (select/get/count/insert/update/delete + sesiones),
   así que ninguna página cambia. Estrategia "hidratar + escribir a través":
     · al iniciar sesión se descargan (con paginación de 1000 filas) las tablas de la empresa a memoria; la lectura, los embeds y los cálculos
       siguen usando la lógica de db.js sobre esa copia; RLS garantiza que solo llegan filas de la empresa del usuario;
     · cada escritura va PRIMERO a Supabase (la base decide: unicidad, llaves foráneas, permisos) y, si tuvo éxito, se refleja en la copia;
     · las operaciones transaccionales llaman a las funciones SQL de 0004 (start_session, save_hour, …);
     · cada 30 s (pestaña visible) se refrescan sesiones/capturas/eventos para ver el trabajo de otros usuarios.
   Límite conocido: con años de datos conviene mover los agregados del Dashboard a vistas/RPC SQL en lugar de calcularlos en el navegador. */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U;
  const BASE = Object.getPrototypeOf(G.db).constructor;      // clase DB de db.js
  const MASTERS = ['customers', 'part_numbers', 'machines', 'part_number_machines', 'operations', 'operation_machine_cycle_times', 'shifts', 'personnel', 'scrap_catalog', 'downtime_catalog'];
  const VOLATILE = ['machine_production_sessions', 'production_captures', 'scrap_events', 'downtime_events'];
  const OTHER = ['notices', 'memberships', 'invitations'];
  const hhmm = (t) => (typeof t === 'string' && /^\d\d:\d\d:\d\d/.test(t) ? t.slice(0, 5) : t);   // Postgres devuelve 07:00:00; la UI usa 07:00
  const norm = { shifts: (r) => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) }), notices: (r) => ({ ...r, send_time: hhmm(r.send_time) }) };
  const sb = () => G.Cloud.client, fail = (m, c) => G.Cloud.fail(m, c);

  class CloudDB extends BASE {
    async init() { this.data = {}; ['companies', ...MASTERS, ...VOLATILE, ...OTHER].forEach((t) => (this.data[t] = [])); this.latency = false; this.companyId = null; this._co = null; this._synced = 0; }
    _save() { /* la persistencia es Supabase */ }
    async _lat() { this._guard(); }
    _guard() { if (!this.companyId) throw fail('This workspace is not active.', 'COMPANY_INACTIVE'); }
    setCompany(id) { this.companyId = id; }
    company() { return this.data.companies.find((c) => c.id === this.companyId) || this._co; }
    reset() { throw fail('Not available with live data.', 'FORBIDDEN'); }

    /* ---------- descarga ---------- */
    async _fetchAll(table) {
      const out = [], size = 1000;
      for (let from = 0; ; from += size) {
        const { data, error } = await sb().from(table).select('*').order('id').range(from, from + size - 1);
        if (error) throw G.Cloud.mapError(error);
        out.push(...data); if (data.length < size) break;
      }
      return norm[table] ? out.map(norm[table]) : out;
    }
    async hydrate(tables) {
      const list = tables || ['companies', ...MASTERS, ...VOLATILE, ...OTHER];
      const res = await Promise.all(list.map((t) => this._fetchAll(t)));
      list.forEach((t, i) => (this.data[t] = res[i]));
      this._synced = Date.now(); G.Cache.invalidate();
    }
    /** Refresca lo que cambia a menudo (otros usuarios capturando) */
    async sync(all) { await this.hydrate(all ? undefined : [...VOLATILE, 'notices']); G.bus.emit('db:change', { table: 'production_captures' }); }
    startPolling() { this.stopPolling(); this._poll = setInterval(() => { if (!document.hidden && this.companyId) this.sync().catch(() => {}); }, 30000); }
    stopPolling() { clearInterval(this._poll); this._poll = null; }

    /* ---------- escrituras (primero la base, luego la copia) ---------- */
    async insert(table, payload) {
      this._guard(); const many = Array.isArray(payload);
      const rows = (many ? payload : [payload]).map((p) => { const r = { ...p, company_id: this.companyId }; delete r.created_at; return r; });
      this._checkUnique(table, rows); this._checkRefs(table, rows);                      // mensajes claros antes de ir a la red; la base valida de todos modos
      const { data, error } = await sb().from(table).insert(rows).select(); if (error) throw G.Cloud.mapError(error);
      const out = norm[table] ? data.map(norm[table]) : data; this.data[table].push(...out); G.bus.emit('db:change', { table });
      return many ? out : out[0];
    }
    async update(table, id, patch) {
      this._guard(); const r = this._byId(table, id); if (!r) throw fail('That record no longer exists.', 'NOT_FOUND');
      this._checkUnique(table, [{ ...r, ...patch }], id); this._checkRefs(table, [{ ...r, ...patch }]);
      const clean = { ...patch }; ['id', 'company_id', 'created_at'].forEach((k) => delete clean[k]);
      const { data, error } = await sb().from(table).update(clean).eq('id', id).select(); if (error) throw G.Cloud.mapError(error);
      if (!data.length) throw fail('You do not have permission to do that.', 'FORBIDDEN');   // RLS filtró la fila
      Object.assign(r, norm[table] ? norm[table](data[0]) : data[0]); G.bus.emit('db:change', { table }); return { ...r };
    }
    async delete(table, id) {
      this._guard(); const used = this._referencedBy(table, id);
      if (used) throw fail(`This record is used by ${used} other record${used > 1 ? 's' : ''} and cannot be deleted.`, 'IN_USE');
      const { error } = await sb().from(table).delete().eq('id', id); if (error) throw G.Cloud.mapError(error);
      this._deleteSync(table, id); G.bus.emit('db:change', { table }); return true;       // los hijos en cascada se borran igual en el servidor
    }
    async deleteCapture(id) {
      this._guard(); const { error } = await sb().from('production_captures').delete().eq('id', id); if (error) throw G.Cloud.mapError(error);
      this._dropEvents(id); this.data.production_captures = this.data.production_captures.filter((c) => c.id !== id); G.bus.emit('db:change', { table: 'production_captures' }); return true;
    }

    /* ---------- transaccionales: funciones SQL (0004) ---------- */
    async _captureRefresh(cap) {             // sustituye en la copia la captura y sus eventos (sin volver a bajar todo)
      const [s, d] = await Promise.all(['scrap_events', 'downtime_events'].map((t) => sb().from(t).select('*').eq('production_capture_id', cap.id)));
      if (s.error || d.error) throw G.Cloud.mapError(s.error || d.error);
      this._dropEvents(cap.id); this.data.scrap_events.push(...s.data); this.data.downtime_events.push(...d.data);
      const i = this.data.production_captures.findIndex((c) => c.id === cap.id); if (i >= 0) this.data.production_captures[i] = cap; else this.data.production_captures.push(cap);
    }
    async startSession(p) {
      this._guard(); const row = await G.Cloud.rpc('start_session', { p_company: this.companyId, p_machine: p.machine_id, p_shift: p.shift_id, p_customer: p.customer_id, p_part: p.part_number_id, p_operation: p.operation_id, p_lot: p.lot_number || null, p_operator: p.operator_id || null, p_supervisor: p.supervisor_id || null });
      this.data.machine_production_sessions.push(row); G.bus.emit('db:change', { table: 'machine_production_sessions' }); return { ...row };
    }
    async saveHour({ session_id, hour_slot, quantity, scrap, downtime }) {
      this._guard(); const cap = await G.Cloud.rpc('save_hour', { p_session: session_id, p_hour_slot: hour_slot, p_production_date: U.ymd(new Date(hour_slot)), p_quantity: Number(quantity), p_scrap: scrap || [], p_downtime: downtime || [] });
      await this._captureRefresh(cap); G.bus.emit('db:change', { table: 'production_captures' }); return { ...cap };
    }
    async deleteHour(session_id, hour_slot) {
      this._guard(); await G.Cloud.rpc('delete_hour', { p_session: session_id, p_hour_slot: hour_slot });
      const cap = this.data.production_captures.find((c) => c.session_id === session_id && c.hour_slot === hour_slot);
      if (cap) { this._dropEvents(cap.id); this.data.production_captures = this.data.production_captures.filter((c) => c.id !== cap.id); }
      G.bus.emit('db:change', { table: 'production_captures' }); return true;
    }
    async finishSessionSingle(session_id, { production_date, quantity, scrap, downtime }) {
      this._guard(); const cap = await G.Cloud.rpc('finish_session_single', { p_session: session_id, p_production_date: production_date || U.today(), p_quantity: Number(quantity), p_scrap: scrap || [], p_downtime: downtime || [] });
      await this.hydrate(VOLATILE); G.bus.emit('db:change', { table: 'production_captures' }); G.bus.emit('db:change', { table: 'machine_production_sessions' }); return { ...cap };
    }
    async consolidateAndFinish(session_id) {
      this._guard(); const cap = await G.Cloud.rpc('consolidate_and_finish', { p_session: session_id });
      await this.hydrate(VOLATILE); G.bus.emit('db:change', { table: 'production_captures' }); G.bus.emit('db:change', { table: 'machine_production_sessions' }); return { ...cap };
    }
    async cancelSession(session_id) {
      this._guard(); const ok = await G.Cloud.rpc('cancel_session', { p_session: session_id });
      const s = this._byId('machine_production_sessions', session_id); if (s) { s.status = 'CANCELLED'; s.finished_at = new Date().toISOString(); }
      G.bus.emit('db:change', { table: 'machine_production_sessions' }); return !!ok;
    }
  }
  /** Convierte el G.db existente en CloudDB SIN crear otra instancia (las páginas ya guardaron la referencia) */
  G.CloudDB = { install() { Object.setPrototypeOf(G.db, CloudDB.prototype); } };
})();
