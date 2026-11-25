/* pages-dashboard.js — Dashboard: pestañas, filtros (popover / bottom sheet), Full Screen. Las vistas viven en dashboard-views*.js */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const TABS = [['general', 'General'], ['production', 'Production'], ['quality', 'Quality'], ['downtime', 'Downtime'], ['plant', 'Plant Now']];
  const DEFAULTS = { period: 'month', from: '', to: '', customerId: '', partNumberId: '', shiftId: '', machineId: '' };
  const S = { host: null, tab: 'general', filters: Object.assign({}, DEFAULTS), tk: 0, last: null, pop: null, offFs: null, offDb: null };
  G.DashViews = G.DashViews || {};

  const activeCount = () => ['customerId', 'partNumberId', 'shiftId', 'machineId'].filter((k) => S.filters[k]).length + (S.filters.period !== 'month' ? 1 : 0);
  G.dashFilters = () => Object.assign({}, S.filters);

  function frame() {
    S.host.innerHTML = `<div class="dash"><div class="dash-tabs"><div class="tabs" role="tablist" aria-label="Dashboard views">${TABS.map(([k, l]) => `<button class="tab${S.tab === k ? ' active' : ''}" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${l}</button>`).join('')}</div></div>
      <div class="dash-bar"><div class="dash-title"><h2 id="dash-title"></h2><span class="badge info" id="dash-badge"></span></div>
        <div class="btn-row"><button class="btn sm" id="dash-filters" aria-haspopup="dialog">${UI.icon('filter', 14)} Filters <span class="count" id="dash-fcount"></span></button><button class="btn sm" id="dash-fs">${UI.icon('maximize', 14)} <span>Full Screen</span></button></div></div>
      <div class="dash-content" id="dash-content" aria-live="polite"></div></div>`;
    U.$$('[data-tab]', S.host).forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
    $('#dash-filters', S.host).onclick = togglePop; $('#dash-fs', S.host).onclick = () => G.toggleFullscreen();
    syncFs(); syncCount();
  }
  function syncCount() { const n = activeCount(), c = $('#dash-fcount', S.host); if (c) { c.textContent = n ? n : ''; c.hidden = !n; c.classList.toggle('chip', !!n); } }
  function syncFs() { const b = $('#dash-fs', S.host); if (!b) return; const fs = G.isFullscreen(); b.innerHTML = `${UI.icon(fs ? 'minimize' : 'maximize', 14)} <span>${fs ? 'Exit Full Screen' : 'Full Screen'}</span>`; }

  /* ---------- Filtros ---------- */
  function togglePop() { if (S.pop) closePop(); else openPop(); }
  function closePop() { if (!S.pop) return; S.pop.remove(); S.pop = null; delete document.body.dataset.filtersOpen; document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } }
  async function openPop() {
    const m = await G.Cache.master(), f = S.filters, sel = (name, list, val, blank, lab) => `<div class="field"><label for="fl-${name}">${blank.label}</label><select id="fl-${name}" name="${name}">${UI.opts(list, val, { blank: blank.all, label: lab, val: (x) => x.id })}</select></div>`;
    const pop = U.el(`<div class="filter-pop" role="dialog" aria-label="Dashboard filters"><div class="fp-backdrop" data-close></div><form class="fp-card" novalidate><div class="fp-head"><b>Filters</b><button type="button" class="icon-btn" data-close aria-label="Close">${UI.icon('x')}</button></div>
      <div class="form-grid"><div class="field"><label for="fl-period">Period</label><select id="fl-period" name="period">${[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This Week'], ['lastweek', 'Previous Week'], ['month', 'This Month'], ['lastmonth', 'Previous Month'], ['year', 'This Year'], ['lastyear', 'Previous Year'], ['custom', 'Custom']].map(([v, l]) => `<option value="${v}"${f.period === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="fl-from">Date From</label><input id="fl-from" type="date" name="from" value="${esc(f.from)}"></div><div class="field"><label for="fl-to">Date To</label><input id="fl-to" type="date" name="to" value="${esc(f.to)}"></div>
      ${sel('customerId', m.customers, f.customerId, { label: 'Customer', all: 'All customers' }, (c) => `${c.code} — ${c.name}`)}${sel('partNumberId', m.part_numbers, f.partNumberId, { label: 'Part Number', all: 'All part numbers' }, (p) => p.part_number)}
      ${sel('shiftId', m.shifts, f.shiftId, { label: 'Shift', all: 'All shifts' }, (s) => `${s.code} — ${s.name}`)}${sel('machineId', m.machines, f.machineId, { label: 'Machine', all: 'All machines' }, (x) => `${x.code} — ${x.name}`)}</div>
      <div class="btn-row fp-foot"><button type="button" class="btn ghost sm" data-clear>Clear filters</button><button type="submit" class="btn primary sm">Done</button></div></form></div>`);
    S.host.querySelector('.dash').appendChild(pop); S.pop = pop; document.body.dataset.filtersOpen = '1';
    document.addEventListener('keydown', onKey, true);
    const form = $('form', pop), apply = () => { U.$$('[name]', form).forEach((el) => (S.filters[el.name] = el.value)); if (S.filters.period !== 'custom' && !S.filters.from && !S.filters.to) { /* rango por periodo */ } syncCount(); render(); };
    form.onchange = () => { if (form.elements.period.value !== 'custom' && (form.elements.from.value || form.elements.to.value)) { /* fechas se ignoran salvo Custom */ } apply(); };
    form.onsubmit = (e) => { e.preventDefault(); closePop(); };
    pop.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closePop(); });
    $('[data-clear]', pop).onclick = () => { S.filters = Object.assign({}, DEFAULTS); closePop(); syncCount(); render(); };
    form.elements.partNumberId.focus();
  }

  /* ---------- Render de pestañas ---------- */
  async function render(useCache) {
    const content = $('#dash-content', S.host); if (!content) return;
    const tk = ++S.tk, tab = S.tab;
    if (G.PlantNow && tab !== 'plant') G.PlantNow.unmount();
    UI.destroyCharts(content);
    if (tab === 'plant') {
      const r = G.Calc.periodRange(S.filters.period, S.filters.from, S.filters.to);
      $('#dash-title', S.host).textContent = 'Plant Now'; $('#dash-badge', S.host).innerHTML = '<span class="live-dot">Live</span>';
      content.innerHTML = '';
      if (G.PlantNow) G.PlantNow.mount(content, { getFilters: G.dashFilters }); else UI.empty(content, 'Plant Now is not available.');
      return;
    }
    content.style.minHeight = '320px';
    if (!useCache || !S.last) UI.loading(content, 'Crunching the numbers…');
    try {
      const s = useCache && S.last ? S.last : await G.Calc.summary(S.filters); if (tk !== S.tk) return;
      S.last = s; $('#dash-title', S.host).textContent = s.range.label; $('#dash-badge', S.host).textContent = `${U.fmtShortDate(s.range.from)} – ${U.fmtShortDate(s.range.to)} · updated ${U.fmtTime(new Date())}`;
      if (!s.total && !s.downMin) { UI.empty(content, 'No captures match these filters. Try a wider period or clear the filters.'); return; }
      content.innerHTML = ''; await G.DashViews[tab](content, s); if (!content._cfgBound) { content._cfgBound = true; G.bindDashCfg(content, () => render(true)); } UI.stagger(content, ':scope > .kpi-grid > *, :scope > .grid > *');
    } catch (e) { console.error(e); if (tk === S.tk) UI.error(content, e, () => render()); }
  }
  function setTab(t) {
    if (t === S.tab) return; S.tab = t; S.last = null;
    U.$$('[data-tab]', S.host).forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    render();
  }

  G.Pages.dashboard = {
    noStagger: true,
    async render(host) {
      S.host = host; frame();
      S.offFs = G.bus.on('fullscreen', () => { syncFs(); if (S.tab !== 'plant') render(true); });
      S.offDb = G.bus.on('db:change', ({ table }) => { if (['production_captures', 'scrap_events', 'downtime_events'].includes(table)) S.last = null; });
      await render();
    },
    refresh() { S.last = null; G.Cache.invalidate(); return render(); },
    onTheme() { if (S.host && S.tab !== 'plant') render(true); },
    destroy() { S.tk++; closePop(); if (G.PlantNow) G.PlantNow.unmount(); if (G.MachinePanel && G.MachinePanel.close) G.MachinePanel.close(); if (S.offFs) S.offFs(); if (S.offDb) S.offDb(); S.host = null; }
  };
})();
