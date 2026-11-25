/* ui.js — componentes compartidos: iconos, modales, confirmaciones, toasts, estados vacío/carga/error, tablas, gráficas */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, esc = U.esc;
  const UI = (G.UI = {});

  /* ---------- Iconos (trazo fino, estilo lucide) ---------- */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    production: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1M12 18h1M7 18h1"/>',
    customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    parts: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    machines: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
    catalog: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    registers: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    personnel: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    runs: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    notices: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    barcode:'<path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/>',
    sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    play: '<path d="m6 3 14 9-14 9z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    companies: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>'
  };
  UI.icon = (name, size = 18) => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------- Logo (hexágono "G") vectorizado: la parte clara usa currentColor del contenedor ---------- */
  UI.logo = (cls = '') => `<svg class="logo-mark ${cls}" viewBox="540 220 840 950" role="img" aria-label="GUVEL"><path class="lg-cyan" d="M609 425 768 333 1139 550 1262 480 890 262 953 225 1362 465V495L1139 623 953 514 799 605 736 641V568L891 478 768 405 609 496Z"/><path class="lg-cyan" d="M968 694H1340V757H1048L1114 796V851L1098 860 929 761Z"/><path class="lg-light" d="M546 461 609 425V887L768 977 889 907 736 819V641L799 605V783L952 871 1035 823 1098 860 768 1050 546 923Z"/><path class="lg-light" d="M1276 757H1340V937L953 1160 890 1123 1276 901Z"/></svg>`;

  /* ---------- Modales ---------- */
  const stack = [];
  let seq = 0;
  UI.modal = ({ title, subtitle, body = '', footer = '', size = 'md', onClose, backdropClose = true, className = '' } = {}) => {
    const id = 'm' + ++seq, prevFocus = document.activeElement;
    const root = U.el(`<div class="modal-backdrop"><div class="modal modal-${size} ${className}" role="dialog" aria-modal="true" aria-labelledby="${id}-t" tabindex="-1">
      <header class="modal-head"><div><h2 id="${id}-t">${esc(title || '')}</h2>${subtitle ? `<p class="muted">${esc(subtitle)}</p>` : ''}</div><button type="button" class="icon-btn" data-close aria-label="Close">${UI.icon('x')}</button></header>
      <div class="modal-body"></div><footer class="modal-foot"${footer ? '' : ' hidden'}></footer></div></div>`);
    const box = U.$('.modal', root), bodyEl = U.$('.modal-body', root), footEl = U.$('.modal-foot', root);
    const setContent = (el, c) => { if (typeof c === 'string') el.innerHTML = c; else if (c) { el.innerHTML = ''; el.appendChild(c); } };
    setContent(bodyEl, body); setContent(footEl, footer);
    const api = {
      el: box, root, body: bodyEl, foot: footEl,
      setBody(c) { setContent(bodyEl, c); }, setFooter(c) { footEl.hidden = !c; setContent(footEl, c); },
      setTitle(t) { U.$('h2', root).textContent = t; },
      close(result) { if (api.closed) return; api.closed = true; const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); root.classList.add('out'); setTimeout(() => root.remove(), G.Prefs.motion() ? 160 : 0); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) { /* ignora */ } if (onClose) onClose(result); }
    };
    root.addEventListener('mousedown', (e) => { if (e.target === root && backdropClose) api.close(); });
    root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
    (document.fullscreenElement || document.body).appendChild(root); stack.push(api);
    requestAnimationFrame(() => { root.classList.add('in'); const f = U.$('input:not([type=hidden]),select,textarea,button:not([data-close])', bodyEl) || box; f.focus && f.focus({ preventScroll: true }); });
    return api;
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) { e.stopPropagation(); stack[stack.length - 1].close(); }
    if (e.key === 'Tab' && stack.length) {                              // trampa de foco simple
      const m = stack[stack.length - 1].el, f = U.$$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', m).filter((x) => x.offsetParent !== null);
      if (!f.length) return; const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  UI.hasModal = () => stack.length > 0;

  UI.confirm = ({ title = 'Please confirm', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) => new Promise((resolve) => {
    let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const m = UI.modal({ title, size: 'sm', body: `<div class="confirm-msg">${message}</div>`, footer: `<button class="btn ghost" data-no>${esc(cancelLabel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirmLabel)}</button>`, onClose: () => fin(false) });
    U.$('[data-no]', m.root).onclick = () => m.close(); U.$('[data-yes]', m.root).onclick = () => { fin(true); m.close(); };
  });

  /* ---------- Toasts ---------- */
  UI.toast = (msg, type = 'ok') => {
    const host = U.$('#toasts'); if (!host) return;
    const t = U.el(`<div class="toast ${type}" role="status">${UI.icon(type === 'err' ? 'alert' : 'check', 16)}<span>${esc(msg)}</span></div>`);
    host.appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 250); }, type === 'err' ? 5000 : 2800);
  };
  /** Convierte cualquier error en un mensaje legible (nunca texto técnico crudo) */
  UI.errMsg = (e) => (e && e.code && e.code !== 'ERR' && e.message ? e.message : e && e.message && !/TypeError|ReferenceError|undefined|null|JSON/.test(e.message) ? e.message : 'Something went wrong. Please try again.');

  /* ---------- Estados ---------- */
  UI.loading = (host, msg = 'Loading…') => { host.innerHTML = `<div class="state state-loading"><span class="spinner" aria-hidden="true"></span><span>${esc(msg)}</span></div>`; };
  UI.empty = (host, msg = 'Nothing here yet.', icon = 'sparkles') => { host.innerHTML = `<div class="state state-empty">${UI.icon(icon, 28)}<span>${esc(msg)}</span></div>`; };
  UI.error = (host, err, retry) => { host.innerHTML = `<div class="state state-error">${UI.icon('alert', 28)}<span>${esc(UI.errMsg(err))}</span>${retry ? '<button class="btn" data-retry>Try again</button>' : ''}</div>`; if (retry) U.$('[data-retry]', host).onclick = retry; };
  UI.skeleton = (n = 4) => `<div class="skeleton-grid">${Array.from({ length: n }, () => '<div class="skeleton-card"></div>').join('')}</div>`;
  UI.stagger = (host, sel = ':scope > *') => { if (!G.Prefs.motion()) return; U.$$(sel, host).forEach((el, i) => { el.style.setProperty('--i', Math.min(i, 14)); el.classList.add('stagger'); }); };

  /* ---------- Tabla ----------
     columns: [{label, key|render(row), cls, align, th}] — devuelve HTML. */
  UI.table = (columns, rows, { empty = 'No records found.', rowAttrs, cls = '' } = {}) => {
    if (!rows.length) return `<div class="state state-empty">${UI.icon('sparkles', 28)}<span>${esc(empty)}</span></div>`;
    return `<div class="table-wrap"><table class="data-table ${cls}"><thead><tr>${columns.map((c) => `<th class="${c.cls || ''}${c.align === 'right' ? ' num' : ''}" scope="col">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr ${rowAttrs ? rowAttrs(r, i) : ''}>${columns.map((c) => `<td class="${c.cls || ''}${c.align === 'right' ? ' num' : ''}" data-label="${esc(c.label)}">${c.render ? c.render(r, i) : esc(r[c.key] == null || r[c.key] === '' ? '—' : r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  UI.opts = (list, value, { label = (x) => x.label, val = (x) => x.value, blank } = {}) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') + list.map((x) => `<option value="${esc(val(x))}"${String(val(x)) === String(value) ? ' selected' : ''}>${esc(label(x))}</option>`).join('');
  UI.badge = (text, kind = 'neutral') => `<span class="badge ${kind}">${esc(text)}</span>`;
  UI.avatar = (name, i = 0) => `<span class="avatar p${i % 6}" aria-hidden="true">${esc(U.initials(name))}</span>`;
  UI.perm = (action, html) => (G.can(action) ? html : '');

  /* ---------- Gráficas (Chart.js leyendo tokens CSS) ---------- */
  UI.cv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  UI.colors = () => ({ c1: UI.cv('--chart-1'), c2: UI.cv('--chart-2'), c3: UI.cv('--chart-3'), run: UI.cv('--state-run'), watch: UI.cv('--state-watch'), stop: UI.cv('--state-stop'), idle: UI.cv('--state-idle'), text: UI.cv('--text-2'), grid: UI.cv('--line-soft'), surface: UI.cv('--surface'), ink: UI.cv('--ink') });
  UI.chart = (canvas, config) => {
    if (!window.Chart) { canvas.parentElement.innerHTML = '<div class="state state-error"><span>Charts library could not be loaded (offline?).</span></div>'; return null; }
    const c = UI.colors(); G.i18n.chartCfg(config);
    Chart.defaults.font.family = UI.cv('--font') || 'system-ui'; Chart.defaults.color = c.text; Chart.defaults.borderColor = c.grid;
    if (canvas._chart) canvas._chart.destroy();
    config.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: G.Prefs.motion() ? { duration: 500 } : false }, config.options || {});
    config.options.plugins = Object.assign({ legend: { display: false }, tooltip: { backgroundColor: c.ink, titleColor: c.surface, bodyColor: c.surface, padding: 10, cornerRadius: 10, displayColors: true, boxPadding: 4 } }, config.options.plugins || {});
    if (config.options.scales) Object.values(config.options.scales).forEach((s) => { s.grid = Object.assign({ color: c.grid, drawBorder: false }, s.grid || {}); s.ticks = Object.assign({ color: c.text }, s.ticks || {}); });
    canvas._chart = new Chart(canvas, config); return canvas._chart;
  };
  UI.destroyCharts = (host) => U.$$('canvas', host).forEach((cv) => { if (cv._chart) { cv._chart.destroy(); cv._chart = null; } });

  /* ---------- Anillos concéntricos SVG (Availability / Performance / Quality + OEE al centro) ---------- */
  UI.rings = (vals, { size = 220, stroke = 14, gap = 6, center = '' } = {}) => {
    const keys = ['availability', 'performance', 'quality'], r0 = size / 2 - stroke / 2 - 2;
    const rings = keys.map((k, i) => {
      const r = r0 - i * (stroke + gap), C = 2 * Math.PI * r, v = vals[k], p = v == null || !isFinite(v) ? 0 : Math.max(0, Math.min(1, v));
      return `<circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/><circle class="ring-val ring-${k}" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    }).join('');
    return `<div class="oee-ring" style="--size:${size}px"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="OEE rings">${rings}</svg><div class="oee-ring-center">${center}</div></div>`;
  };
})();
