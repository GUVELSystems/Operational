/* plant-now.js — pestaña Plant Now: hive hexagonal por familia, panel de OEE de planta, Targets y auto-refresh 60 s
   Contrato: G.Calc.liveMachines() → [{machine, family, session|null, state:'run'|'watch'|'idle', oee, a, p, q, hoursLogged, partNumber, operation}]
             G.Calc.plantLive()    → {oee, a, p, q} (o nulls) */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const S = { el: null, timer: null, tk: 0, mounted: false, last: 0, offTargets: null, offDb: null, dbT: 0, data: null, getFilters: null };
  const STATE_LABEL = { run: 'Running', watch: 'Below target', idle: 'Idle' };
  const KEYS = [['availability', 'Availability', 'a'], ['performance', 'Performance', 'p'], ['quality', 'Quality', 'q']];
  const numKey = (c) => { const m = String(c || '').match(/(\d+)\s*$/); return m ? Number(m[1]) : 0; };
  const famOf = (c) => String(c || '').split('-')[0] || 'OTHER';
  const txt = (v, f) => (v == null ? '' : typeof v === 'object' ? String(v[f] == null ? '' : v[f]) : String(v));

  /* ---------- Estructura estable (no se destruye al refrescar) ---------- */
  function shell() {
    S.el.innerHTML = `<div class="pn">
      <section class="pn-hive-wrap panel" aria-label="Machines now">
        <div class="pn-toolbar"><div class="pn-legend" id="pn-legend"></div>
          <div class="btn-row"><span class="live-dot" id="pn-live">Live</span><span class="muted small" id="pn-upd"></span>${G.can('targets') ? `<button class="btn sm" id="pn-targets">${UI.icon('target', 14)} Targets</button>` : ''}</div></div>
        <div class="pn-hive" id="pn-hive"><div class="state state-loading"><span class="spinner"></span><span>Loading machines…</span></div></div>
      </section>
      <aside class="pn-side" id="pn-side" aria-label="Plant OEE"></aside></div>`;
    const tb = $('#pn-targets', S.el); if (tb) tb.onclick = openTargets;
    $('#pn-hive', S.el).addEventListener('click', (e) => { const c = e.target.closest('.hex-cell'); if (c && G.MachinePanel) G.MachinePanel.open(c.dataset.id); });
  }

  /* ---------- Hive ---------- */
  function cellHTML(it) {
    const m = it.machine, st = it.state === 'run' || it.state === 'watch' ? it.state : 'idle';
    if (!it.session) return `<button class="hex-cell state-idle" data-id="${esc(m.id)}" aria-label="${esc(m.code)} idle"><span class="hex-inner"><b class="hx-code">${esc(m.code)}</b><span class="hx-idle">Idle</span></span></button>`;
    const op = it.operation, opTxt = op && typeof op === 'object' ? `${op.operation_number} · ${op.operation_name}` : txt(op);
    return `<button class="hex-cell state-${st}" data-id="${esc(m.id)}" aria-label="${esc(m.code)} ${STATE_LABEL[st]}, OEE ${U.pct(it.oee, 0)}"><span class="hex-inner"><b class="hx-code">${esc(m.code)}</b><span class="hx-oee">${U.pct(it.oee, 0)}</span><span class="hx-part">${esc(txt(it.partNumber, 'part_number'))}</span><span class="hx-op">${esc(opTxt)}</span></span></button>`;
  }
  function drawHive(list) {
    const groups = {};
    list.forEach((it) => { const f = it.family || famOf(it.machine.code); (groups[f] = groups[f] || []).push(it); });
    const fams = Object.keys(groups).sort();
    const cnt = { run: 0, watch: 0, idle: 0 }; list.forEach((it) => { cnt[it.session ? (it.state === 'watch' ? 'watch' : 'run') : 'idle']++; });
    $('#pn-legend', S.el).innerHTML = ['run', 'watch', 'idle'].map((k) => `<span class="pn-leg"><i class="state-dot ${k === 'watch' ? 'watch' : k === 'run' ? 'run' : ''}"></i>${STATE_LABEL[k]} <b>${cnt[k]}</b></span>`).join('');
    $('#pn-hive', S.el).innerHTML = list.length ? fams.map((f) => `<div class="hex-family"><h3 class="family-head"><span>${esc(f)}</span><small class="muted">${groups[f].length} machine${groups[f].length > 1 ? 's' : ''}</small></h3><div class="hex-row">${groups[f].sort((a, b) => numKey(a.machine.code) - numKey(b.machine.code)).map(cellHTML).join('')}</div></div>`).join('') : '<div class="state state-empty"><span>No machines yet. Add one in Machines.</span></div>';
  }

  /* ---------- Panel derecho ---------- */
  function drawSide(pl) {
    const t = G.Targets.get(), oee = pl ? pl.oee : null, key = oee == null ? 'idle' : G.statusVsTarget(oee, t.oee).key;   // el color del OEE de planta sigue el Target configurado
    const rows = KEYS.map(([k, label, s]) => {
      const v = pl ? pl[s] : null, st = G.statusVsTarget(v, t[k]), w = v == null || !isFinite(v) ? 0 : Math.max(0, Math.min(1, v)) * 100;
      return `<div class="pn-bar"><div class="pn-bar-head"><span>${label}</span><b>${U.pct(v, 1)}</b></div>
        <div class="progress" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(w)}"><div class="bar ${st.key === 'run' ? '' : st.key}" style="width:${w}%"></div><span class="target-mark" style="left:${t[k] * 100}%" title="Target ${U.pct(t[k], 0)}"></span></div>
        <div class="pn-bar-foot"><span class="muted small">Target ${U.pct(t[k], 0)}</span><span class="badge ${st.key}">${esc(st.label)}</span></div></div>`;
    }).join('');
    $('#pn-side', S.el).innerHTML = `<div class="panel pn-plant"><div class="panel-head"><h2>Plant OEE</h2><span class="muted small">Live · running sessions</span></div>
      <div class="pn-oee c-${key}">${UI.rings({ availability: pl ? pl.a : null, performance: pl ? pl.p : null, quality: pl ? pl.q : null }, { size: 220, stroke: 14, gap: 5, center: `<b>${U.pct(oee, 1)}</b><span class="muted">OEE · Target ${U.pct(t.oee, 0)}</span>` })}</div>
      <div class="pn-bars">${rows}</div></div>`;
  }

  async function refresh(silent) {
    if (!S.mounted) return;
    const tk = ++S.tk;
    try {
      if (!G.Calc || !G.Calc.liveMachines) throw new Error('Calculation module not available');
      const [list, pl] = await Promise.all([G.Calc.liveMachines(), G.Calc.plantLive ? G.Calc.plantLive().catch(() => null) : null]);
      if (tk !== S.tk || !S.mounted) return;
      S.data = list; S.last = Date.now(); drawHive(list); drawSide(pl);
      const u = $('#pn-upd', S.el); if (u) u.textContent = `Updated ${U.fmtTime(new Date())}`;
    } catch (e) {
      console.error(e); if (tk !== S.tk || !S.mounted) return;
      if (!silent || !S.data) UI.error($('#pn-hive', S.el), e, () => refresh());
    }
  }

  /* ---------- Diálogo Targets ---------- */
  function openTargets() {
    if (!G.can('targets')) { UI.toast('Your role cannot change targets.', 'err'); return; }
    const t = G.Targets.get();
    const f = (k, label) => `<div class="field"><label for="tg-${k}">${label} target (%)</label><input id="tg-${k}" type="number" min="1" max="100" step="1" value="${Math.round(t[k] * 100)}"></div>`;
    const m = UI.modal({ title: 'Targets', subtitle: 'Saved in this browser. They colour the hive, the bars and the machine panel.', size: 'sm', body: `<form id="tg-form" novalidate><div class="form-grid">${f('oee', 'OEE')}${f('availability', 'Availability')}${f('performance', 'Performance')}${f('quality', 'Quality')}</div><div class="form-error" id="tg-err" hidden role="alert" style="margin-top:12px"></div></form>`, footer: '<button class="btn ghost" data-reset>Restore defaults</button><button class="btn primary" data-save>Save targets</button>' });
    $('[data-reset]', m.root).onclick = () => { G.Targets.reset(); m.close(); UI.toast('Targets restored'); };
    $('[data-save]', m.root).onclick = () => {
      const out = {}; let bad = false;
      ['oee', 'availability', 'performance', 'quality'].forEach((k) => { const v = Number($('#tg-' + k, m.root).value); if (!isFinite(v) || v < 1 || v > 100) bad = true; out[k] = v / 100; });
      if (bad) { const e = $('#tg-err', m.root); e.hidden = false; e.textContent = 'Each target must be a number between 1 and 100.'; return; }
      G.Targets.set(out); m.close(); UI.toast('Targets saved');
    };
    $('#tg-form', m.root).onsubmit = (e) => { e.preventDefault(); $('[data-save]', m.root).click(); };
  }

  /* ---------- Auto-refresh 60 s ---------- */
  function tick() {
    if (!S.mounted || document.hidden || !G.Prefs.live() || document.body.dataset.filtersOpen === '1') return;
    refresh(true);
  }
  function mount(el, opts) {
    unmount(); S.el = el; S.mounted = true; S.getFilters = (opts && opts.getFilters) || null; S.data = null;
    shell(); refresh();
    S.timer = setInterval(tick, 60000);
    S.offTargets = G.bus.on('targets', () => refresh(true));
    S.offDb = G.bus.on('db:change', ({ table }) => { if (['machine_production_sessions', 'production_captures'].includes(table)) { clearTimeout(S.dbT); S.dbT = setTimeout(() => refresh(true), 400); } });
  }
  function unmount() {
    S.mounted = false; S.tk++; clearInterval(S.timer); S.timer = null; clearTimeout(S.dbT);
    if (S.offTargets) { S.offTargets(); S.offTargets = null; } if (S.offDb) { S.offDb(); S.offDb = null; }
  }
  G.PlantNow = { mount, unmount, refresh: () => refresh(), openTargets };
})();
