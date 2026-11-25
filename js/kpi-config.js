/* kpi-config.js — engrane de configuración: condiciones por KPI (mayor / menor / entre, con color) y límites por gráfica (min, max, objetivo).
   Se guarda en este navegador (localStorage), igual que los Targets. */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const rd = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin persistencia */ } };
  const num = (v) => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v));
  const DEF = { gt: '#0CC0DF', lt: '#FF3B30', bt: '#0CC0DF' };

  /* ---------- Condiciones por KPI ---------- */
  G.KpiCfg = {
    all: () => rd('guvel_kpicfg'),
    get(key) { return this.all()[key] || null; },
    set(key, cfg) { const a = this.all(); a[key] = cfg; wr('guvel_kpicfg', a); },
    reset(key) { const a = this.all(); delete a[key]; wr('guvel_kpicfg', a); },
    /** {state:'none'|'in'|'out', color} para el valor crudo (en la unidad del KPI) */
    evaluate(key, raw) {
      const c = this.get(key); if (!c || raw == null || !isFinite(raw)) return { state: 'none' };
      const rules = [['gt', c.gt && c.gt.on && num(c.gt.v) != null && raw > num(c.gt.v), c.gt && c.gt.color], ['lt', c.lt && c.lt.on && num(c.lt.v) != null && raw < num(c.lt.v), c.lt && c.lt.color],
        ['bt', c.bt && c.bt.on && num(c.bt.a) != null && num(c.bt.b) != null && raw >= num(c.bt.a) && raw <= num(c.bt.b), c.bt && c.bt.color]];
      const active = ['gt', 'lt', 'bt'].some((k) => c[k] && c[k].on && (k === 'bt' ? num(c.bt.a) != null && num(c.bt.b) != null : num(c[k].v) != null));
      if (!active) return { state: 'none' };
      const hit = rules.find((r) => r[1]); return hit ? { state: 'in', color: hit[2] || DEF[hit[0]] } : { state: 'out' };
    }
  };
  G.openKpiConfig = ({ key, label, formula, unit, onSave }) => {
    const c = G.KpiCfg.get(key) || {}, g = c.gt || {}, l = c.lt || {}, b = c.bt || {};
    const row = (name, title, v, color, on, extra) => `<div class="cfg-row"><div class="field"><label for="kc-${name}">${title}</label><input id="kc-${name}" type="number" step="any" value="${v == null ? '' : esc(v)}"></div>${extra || ''}<div class="field"><label>Color</label><input class="cfg-color" id="kc-${name}-c" type="color" value="${esc(color)}"></div><label class="check cfg-on"><input type="checkbox" id="kc-${name}-on" ${on ? 'checked' : ''}> <span>Active</span></label></div>`;
    const m = UI.modal({ title: label, subtitle: 'KPI CONFIGURATION', size: 'md', className: 'cfg-modal', body: `<div class="cfg-formula"><b>Formula</b><span>${esc(formula)}</span></div>
      ${row('gt', 'Mayor que', g.v, g.color || DEF.gt, g.on)}${row('lt', 'Menor que', l.v, l.color || DEF.lt, l.on)}
      ${row('bt', 'Entre', b.a, b.color || DEF.bt, b.on, `<div class="field"><label for="kc-bt-b">y</label><input id="kc-bt-b" type="number" step="any" value="${b.b == null ? '' : esc(b.b)}"></div>`)}
      <p class="muted small">Unit: ${esc(unit || '—')}</p>`, footer: '<button class="btn" data-reset style="margin-right:auto">Reset</button><button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>Save</button>' });
    $('[data-reset]', m.root).onclick = () => { G.KpiCfg.reset(key); m.close(); if (onSave) onSave(); };
    $('[data-save]', m.root).onclick = () => {
      const v = (id) => $('#kc-' + id, m.root).value, on = (id) => $('#kc-' + id + '-on', m.root).checked, col = (id) => $('#kc-' + id + '-c', m.root).value;
      G.KpiCfg.set(key, { gt: { v: num(v('gt')), color: col('gt'), on: on('gt') }, lt: { v: num(v('lt')), color: col('lt'), on: on('lt') }, bt: { a: num(v('bt')), b: num(v('bt-b')), color: col('bt'), on: on('bt') } });
      m.close(); if (onSave) onSave();
    };
  };

  /* ---------- Límites por gráfica: líneas de referencia Min / Max / Objetivo ---------- */
  G.ChartCfg = {
    all: () => rd('guvel_chartcfg'), get(key) { return this.all()[key] || null; },
    set(key, v) { const a = this.all(); a[key] = v; wr('guvel_chartcfg', a); }, reset(key) { const a = this.all(); delete a[key]; wr('guvel_chartcfg', a); },
    /** Añade las líneas de referencia (y amplía el eje Y) a una configuración de Chart.js */
    apply(config, key) {
      const c = this.get(key); if (!c) return config;
      const lines = [['Min', num(c.min), '#E8A92B'], ['Max', num(c.max), '#E07A6B'], ['Target', num(c.target), '#1FB37A']].filter((x) => x[1] != null);
      if (!lines.length) return config;
      const vals = lines.map((x) => x[1]), y = ((config.options = config.options || {}).scales = config.options.scales || {}).y = (config.options.scales.y || {});
      y.suggestedMin = Math.min.apply(null, vals.concat(y.suggestedMin == null ? [] : [y.suggestedMin])); y.suggestedMax = Math.max.apply(null, vals);
      config.plugins = (config.plugins || []).concat([{ id: 'refLines', afterDatasetsDraw(ch) {
        const a = ch.chartArea, sc = ch.scales.y, x = ch.ctx; x.save(); x.font = '600 11px sans-serif'; x.textBaseline = 'bottom';
        lines.forEach(([name, val, col]) => { const py = sc.getPixelForValue(val); if (py < a.top - 1 || py > a.bottom + 1) return; x.setLineDash([6, 5]); x.strokeStyle = col; x.lineWidth = 1.6; x.beginPath(); x.moveTo(a.left, py); x.lineTo(a.right, py); x.stroke(); x.setLineDash([]); x.fillStyle = col; x.textAlign = 'right'; x.fillText(`${G.t(name)} ${U.fmtNum(val, 2).replace(/\.?0+$/, '')}`, a.right - 4, py - 3); });
        x.restore(); } }]);
      return config;
    }
  };
  G.openChartConfig = ({ key, label, unit, color, onSave }) => {
    const c = G.ChartCfg.get(key) || {}, nz = Object.assign({}, G.NEON.def, c.neon || {}), f = (id, t, v) => `<div class="field"><label for="cc-${id}">${t}</label><input id="cc-${id}" type="number" step="any" value="${v == null ? '' : esc(v)}"></div>`;
    const m = UI.modal({ title: label, subtitle: 'CHART CONFIGURATION', size: 'md', className: 'cfg-modal', body: `<div class="cfg-formula"><b>Graph controls</b><span>Optional lower limit, upper limit and objective. They are displayed as reference lines on the graph.</span></div><div class="cfg-row3">${f('min', 'Min', c.min)}${f('max', 'Max', c.max)}${f('target', 'Objetivo', c.target)}</div>${color ? `<div class="cfg-formula" style="margin-top:14px"><b>Trend color</b><span>Color of the line or bars (and its neon dot).</span></div><div class="cfg-row3"><div class="field"><label for="cc-color">Color</label><input class="cfg-color" id="cc-color" type="color" value="${esc(c.color || color)}"></div></div>` : ''}<div class="cfg-formula" style="margin-top:14px"><b>Neon dot</b><span>The light that travels along the graph.</span></div><div class="cfg-row3 cfg-neon"><div class="field"><label for="cc-speed">Speed</label><select id="cc-speed">${[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']].map((o) => `<option value="${o[0]}"${nz.speed === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div><div class="field"><label for="cc-shape">Shape</label><select id="cc-shape">${[['circle', 'Circle'], ['diamond', 'Diamond'], ['x', 'X'], ['star', 'Star'], ['triangle', 'Triangle'], ['none', 'No shape (light only)']].map((o) => `<option value="${o[0]}"${nz.shape === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div></div><p class="muted small">Unit: ${esc(unit || '—')}</p>`, footer: '<button class="btn" data-reset style="margin-right:auto">Reset</button><button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>Save</button>' });
    $('[data-reset]', m.root).onclick = () => { G.ChartCfg.reset(key); m.close(); if (onSave) onSave(); };
    $('[data-save]', m.root).onclick = () => { const v = (id) => num($('#cc-' + id, m.root).value); G.ChartCfg.set(key, { min: v('min'), max: v('max'), target: v('target'), color: color ? $('#cc-color', m.root).value : null, neon: { speed: $('#cc-speed', m.root).value, shape: $('#cc-shape', m.root).value } }); m.close(); if (onSave) onSave(); };
  };

  /** Delegación de clics de los engranes dentro del contenido del Dashboard */
  G.bindDashCfg = (el, rerender) => {
    el.addEventListener('click', (e) => {
      const k = e.target.closest('[data-kpi-cfg]'), ch = e.target.closest('[data-chart-cfg]');
      if (k) G.openKpiConfig({ key: k.dataset.kpiCfg, label: k.dataset.label, formula: k.dataset.formula, unit: k.dataset.unit, onSave: rerender });
      else if (ch) G.openChartConfig({ key: ch.dataset.chartCfg, label: ch.dataset.label, unit: ch.dataset.unit, color: ch.dataset.color, onSave: rerender });
    });
  };
})();
