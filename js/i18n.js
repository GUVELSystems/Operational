/* i18n.js — idioma del portal (EN / ES). El código fuente está en inglés; en español el texto de la interfaz se traduce con un diccionario
   exacto (G.i18n.add) y patrones para textos dinámicos (G.i18n.addPatterns). Ramiro AI, los correos de Notices y las gráficas siguen el mismo idioma.
   - G.lang: 'en' | 'es' (guardado; por defecto el idioma del navegador).  - G.t(texto): traduce una cadena.  - G.L(es, en): elige según el idioma.
   - G.setLang(l): cambia el idioma y emite 'lang' (app.js vuelve a pintar la página). */
(function () {
  const G = (window.G = window.G || {});
  const KEY = 'guvel_lang';
  const detect = () => { try { const s = localStorage.getItem(KEY); if (s === 'es' || s === 'en') return s; } catch (e) { /* sin persistencia */ } return String(navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'; };
  G.lang = detect();
  document.documentElement.setAttribute('lang', G.lang);

  const dict = Object.create(null), pats = [], norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CANVAS', 'IFRAME', 'CODE', 'NOSCRIPT', 'PRE']);
  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip', 'data-label', 'alt'];

  /** Traduce un texto (conserva los espacios de los extremos). force=true ignora G.lang (para correos). */
  function tr(s, force) {
    if (s == null || (!force && G.lang !== 'es')) return s;
    const str = String(s), m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str); if (!m || !m[2]) return s;
    const core = norm(m[2]); let v = dict[core];
    if (v == null) {                                            // variantes con puntuación final: "Name:" / "Loading…" / "Saved."
      const t = /^(.*?)([:.…]+)$/.exec(core); if (t && dict[t[1]] != null) v = dict[t[1]] + t[2];
    }
    if (v == null) for (let i = 0; i < pats.length; i++) { const p = pats[i]; if (p[0].test(core)) { v = core.replace(p[0], p[1]); break; } }
    return v == null ? s : m[1] + v + m[3];
  }
  function walk(root, force) {
    if (!root) return;
    if (root.nodeType === 3) { const v = tr(root.nodeValue, force); if (v !== root.nodeValue) root.nodeValue = v; return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    const doAttrs = (el) => { for (let i = 0; i < ATTRS.length; i++) { const a = ATTRS[i]; if (el.hasAttribute && el.hasAttribute(a)) { const o = el.getAttribute(a), v = tr(o, force); if (v !== o) el.setAttribute(a, v); } } };
    if (root.nodeType === 1) { if (root.tagName === 'CANVAS') { doAttrs(root); return; } if (SKIP.has(root.tagName) || root.hasAttribute('data-notr')) return; doAttrs(root); }
    if (root.querySelectorAll) root.querySelectorAll('canvas').forEach(doAttrs);
    const tw = document.createTreeWalker(root, 1 | 4, { acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.tagName) || n.hasAttribute('data-notr')) ? 2 : 1) });   // 2 = REJECT (salta el subárbol)
    let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) { const v = tr(n.nodeValue, force); if (v !== n.nodeValue) n.nodeValue = v; } else doAttrs(n); }
  }

  /* Observador acotado: solo traduce los nodos que se agregan (en lotes por frame) mientras el idioma es ES */
  const queue = new Set(); let raf = 0;
  const flush = () => { raf = 0; const a = Array.from(queue); queue.clear(); a.forEach((n) => { if (n.isConnected) walk(n); }); };
  const mo = new MutationObserver((ms) => {
    if (G.lang !== 'es') return;
    for (const m of ms) { if (m.type === 'characterData') queue.add(m.target); else m.addedNodes.forEach((n) => queue.add(n)); }
    if (queue.size && !raf) raf = requestAnimationFrame(flush);
  });
  const start = () => { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); if (G.lang === 'es') walk(document.body); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  G.i18n = {
    add(o) { for (const k in o) dict[norm(k)] = o[k]; },
    addPatterns(a) { a.forEach((p) => pats.push(p)); },
    t: (s) => tr(s), tForce: (s) => tr(s, true), apply: (root) => walk(root || document.body),
    /** Traduce un fragmento HTML (para los correos) sin tocar el idioma de la interfaz */
    html(html, lang) { if (lang !== 'es') return html; const d = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html'); walk(d.body, true); return d.body.innerHTML; },
    /** Traduce las etiquetas de una configuración de Chart.js (labels, datasets, títulos de ejes) */
    chartCfg(cfg) {
      if (G.lang !== 'es' || !cfg) return cfg;
      const d = cfg.data || {}; if (Array.isArray(d.labels)) d.labels = d.labels.map((x) => (typeof x === 'string' ? tr(x) : x));
      (d.datasets || []).forEach((ds) => { if (typeof ds.label === 'string') ds.label = tr(ds.label); });
      const sc = (cfg.options && cfg.options.scales) || {}; Object.keys(sc).forEach((k) => { const t = sc[k] && sc[k].title; if (t && typeof t.text === 'string') t.text = tr(t.text); });
      return cfg;
    },
    size: () => Object.keys(dict).length
  };
  G.t = (s) => tr(s);
  G.L = (es, en) => (G.lang === 'es' ? es : en);
  G.setLang = (l) => {
    if (l !== 'es' && l !== 'en') return; if (l === G.lang) return;
    G.lang = l; try { localStorage.setItem(KEY, l); } catch (e) { /* sin persistencia */ }
    document.documentElement.setAttribute('lang', l);
    if (G.bus) G.bus.emit('lang', l);
  };
})();
