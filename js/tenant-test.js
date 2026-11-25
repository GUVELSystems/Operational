/* tenant-test.js — prueba de aislamiento entre empresas.
   Crea una empresa "sonda" temporal con datos propios y verifica que la empresa activa NO pueda leerlos, modificarlos, borrarlos
   ni referenciarlos. Al terminar elimina la sonda. En Supabase el equivalente es supabase/tests/isolation.sql (RLS). */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc;

  G.Tenant.isolationTest = async () => {
    const db = G.db, data = db.data, me = db.companyId, res = [], now = new Date().toISOString();
    const rec = (name, ok, detail) => res.push({ name, ok: !!ok, detail: detail || '' });
    const probeId = U.uid(), mk = (o) => Object.assign({ id: U.uid(), company_id: probeId, created_at: now }, o);
    const pCust = mk({ code: 'PROBE-C', name: 'Probe customer' }), pMach = mk({ code: 'PROBE-M', name: 'Probe machine' }), pShift = mk({ code: 'PROBE-S', name: 'Probe shift' });
    const pPart = mk({ part_number: 'PROBE-PN', description: 'Probe part', customer_id: pCust.id });
    data.companies.push({ id: probeId, company_id: probeId, name: 'Isolation probe', slug: '__probe__', status: 'active', demo: false, created_at: now });
    data.customers.push(pCust); data.machines.push(pMach); data.shifts.push(pShift); data.part_numbers.push(pPart);
    const tables = G.DB_TABLES.filter((t) => t !== 'companies'), expectFail = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
    try {
      // 1. Lecturas: solo filas de mi empresa
      let leak = [];
      for (const t of tables) { const rows = await db.select(t); if (rows.some((r) => r.company_id !== me)) leak.push(t); }
      rec('select() returns only this company’s rows (all tables)', !leak.length, leak.join(', '));
      const own = await db.select('companies'); rec('Only my own company record is visible', own.length === 1 && own[0].id === me);
      // 2. Lectura directa por id ajeno
      const g1 = await db.get('customers', pCust.id), g2 = await db.get('machines', pMach.id), g3 = await db.get('part_numbers', pPart.id, { embed: ['customers'] });
      rec('get() on another company’s id returns nothing', !g1 && !g2 && !g3);
      rec('count() ignores another company’s rows', (await db.count('customers')) === data.customers.filter((r) => r.company_id === me).length);
      rec('Filters cannot reach another company’s rows', (await db.select('customers', { where: { code: 'PROBE-C' } })).length === 0);
      // 3. Escritura / borrado ajeno
      const before = JSON.stringify(pCust), e1 = await expectFail(() => db.update('customers', pCust.id, { name: 'HACKED' }));
      rec('update() on another company’s row is rejected', e1 && e1.code === 'NOT_FOUND' && JSON.stringify(pCust) === before, e1 ? e1.code : 'no error');
      await expectFail(() => db.delete('customers', pCust.id));
      rec('delete() on another company’s row does nothing', data.customers.some((r) => r.id === pCust.id));
      // 4. company_id forzado en inserciones
      const ins = await db.insert('customers', { code: 'ISO-TST', name: 'Isolation test', company_id: probeId });
      rec('insert() ignores a forged company_id', ins.company_id === me); await db.delete('customers', ins.id);
      const upd = await db.insert('customers', { code: 'ISO-TS2', name: 'Isolation test 2' }); await db.update('customers', upd.id, { company_id: probeId });
      rec('update() cannot move a row to another company', data.customers.find((r) => r.id === upd.id).company_id === me); await db.delete('customers', upd.id);
      // 5. Referencias cruzadas (equivale a la FK compuesta (company_id, id))
      const e2 = await expectFail(() => db.insert('part_numbers', { part_number: 'ISO-PN', description: 'x', customer_id: pCust.id }));
      rec('Cannot reference another company’s customer (FK)', e2 && e2.code === 'FOREIGN_REFERENCE', e2 ? e2.code : 'no error');
      const e3 = await expectFail(() => db.insert('part_number_machines', { part_number_id: pPart.id, machine_id: pMach.id }));
      rec('Cannot link another company’s part and machine', e3 && e3.code === 'FOREIGN_REFERENCE', e3 ? e3.code : 'no error');
      // 6. Estado de la empresa y membresías
      const c = db.company(); c.status = 'suspended'; const e4 = await expectFail(() => db.select('customers')); c.status = 'active';
      rec('A suspended company cannot read or write anything', e4 && e4.code === 'COMPANY_INACTIVE', e4 ? e4.code : 'no error');
      if (!c.demo) {
        const prev = G.user; data.memberships.push({ id: U.uid(), company_id: probeId, email: 'probe@other-company.test', role: 'owner', status: 'active', created_at: now });
        const e5 = await expectFail(() => G.Tenant.signIn('probe@other-company.test', 'owner')); G.user = prev;
        rec('A member of another company cannot sign in here', e5 && e5.code === 'NO_ACCESS', e5 ? e5.code : 'signed in');
      } else rec('Memberships: sign-in requires an active membership (non-demo companies)', true, 'demo company: any email allowed, skipped');
    } finally {
      ['customers', 'machines', 'shifts', 'part_numbers'].forEach((t) => (data[t] = data[t].filter((r) => r.company_id !== probeId)));
      data.companies = data.companies.filter((x) => x.id !== probeId); data.memberships = data.memberships.filter((m) => m.company_id !== probeId); db.companyId = me; db._save();
    }
    return res;
  };

  G.Tenant.runIsolationTest = async () => {
    const m = UI.modal({ title: 'Company isolation test', subtitle: `Active company: ${G.db.company().name}`, size: 'md', body: '<div class="state state-loading"><span class="spinner"></span><span>Running checks…</span></div>' });
    let res; try { res = await G.Tenant.isolationTest(); } catch (e) { m.setBody(`<div class="state state-error"><span>${esc(e.message)}</span></div>`); return; }
    const ok = res.filter((r) => r.ok).length, all = ok === res.length;
    m.setBody(`<div class="iso-sum ${all ? 'good' : 'bad'}"><b>${ok} / ${res.length}</b> ${all ? G.L('verificaciones superadas — sin fugas entre empresas.', 'checks passed — no leaks between companies.') : G.L('verificaciones superadas — HAY FUGAS.', 'checks passed — LEAKS FOUND.')}</div><ul class="iso-list">${res.map((r) => `<li class="${r.ok ? 'ok' : 'bad'}"><span>${UI.icon(r.ok ? 'check' : 'x', 15)}</span><div><b>${esc(G.t(r.name))}</b>${r.detail ? `<small class="muted">${esc(r.detail)}</small>` : ''}</div></li>`).join('')}</ul>`);
  };
})();
