/* util.js — utilidades globales: DOM, fechas, formato, turnos (G.Shift), bus de eventos */
(function () {
  const G = (window.G = window.G || {});
  const U = (G.U = {});
  G.Pages = G.Pages || {};

  /* ---------- DOM ---------- */
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  U.norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  U.debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.sum = (arr, fn) => arr.reduce((s, x) => s + (Number(fn ? fn(x) : x) || 0), 0);
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Fechas ---------- */
  const pad = (U.pad = (n) => String(n).padStart(2, '0'));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MON_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const es = () => G.lang === 'es';
  U.ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  U.parseYmd = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  U.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  U.today = () => U.ymd(new Date());
  U.fmtDate = (s) => { if (!s) return '—'; const d = typeof s === 'string' && s.length <= 10 ? U.parseYmd(s) : new Date(s); return es() ? `${d.getDate()} ${MON_ES[d.getMonth()]} ${d.getFullYear()}` : `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
  U.fmtShortDate = (s) => { const d = typeof s === 'string' && s.length <= 10 ? U.parseYmd(s) : new Date(s); return es() ? `${d.getDate()} ${MON_ES[d.getMonth()]}` : `${MON[d.getMonth()]} ${d.getDate()}`; };
  U.fmtTime = (s) => { if (!s) return '—'; const d = new Date(s); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  U.fmtDateTime = (s) => (s ? `${U.fmtDate(new Date(s))} ${U.fmtTime(s)}` : '—');
  U.hmsToMin = (t) => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  U.minToHm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m % 60))}`;
  U.hm = (t) => (t ? String(t).slice(0, 5) : '—');
  U.diffDays = (a, b) => Math.round((U.parseYmd(a) - U.parseYmd(b)) / 864e5);

  /* ---------- Formato ---------- */
  U.fmtNum = (n, dec = 0) => (n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
  U.pct = (x, dec = 1) => (x == null || !isFinite(x) ? '—' : (x * 100).toFixed(dec) + '%');
  U.money = (n) => (n == null || !isFinite(n) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  U.initials = (s) => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  /* ---------- CSV ---------- */
  U.csv = (rows, cols) => {
    const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [cols.map((c) => q(c.label)).join(','), ...rows.map((r) => cols.map((c) => q(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','))].join('\r\n');
  };
  U.download = (name, text, mime = 'text/csv;charset=utf-8') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /* ---------- Bus de eventos ---------- */
  const bus = {};
  G.bus = {
    on(ev, fn) { (bus[ev] = bus[ev] || []).push(fn); return () => G.bus.off(ev, fn); },
    off(ev, fn) { bus[ev] = (bus[ev] || []).filter((f) => f !== fn); },
    emit(ev, d) { (bus[ev] || []).slice().forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); }
  };

  /* ---------- Turnos (G.Shift) ----------
     Una "hora de Real Time" es un tramo de 60 min (el último puede ser más corto) de la ventana del turno. */
  const Shift = (G.Shift = {});
  Shift.hasSchedule = (sh) => !!(sh && sh.start_time && sh.end_time);
  Shift.startMin = (sh) => U.hmsToMin(sh.start_time);
  Shift.durationMin = (sh) => { const s = U.hmsToMin(sh.start_time), e = U.hmsToMin(sh.end_time); return e <= s ? e + 1440 - s : e - s; };
  Shift.plannedMin = (sh) => Math.max(0, Shift.durationMin(sh) - (Number(sh.excluded_planned_minutes) || 0));
  Shift.windowLabel = (sh) => (Shift.hasSchedule(sh) ? `${U.hm(sh.start_time)}–${U.hm(sh.end_time)}` : 'No schedule');
  /** Ventana (Date inicio/fin) para una sesión iniciada en `startedAt`. */
  Shift.windowFor = (sh, startedAt) => {
    const st = new Date(startedAt);
    const base = new Date(st.getFullYear(), st.getMonth(), st.getDate(), 0, 0, 0, 0);
    base.setMinutes(Shift.startMin(sh));
    if (st < base) base.setDate(base.getDate() - 1);          // sesión iniciada antes del inicio nominal → ventana del día anterior
    const end = new Date(base.getTime() + Shift.durationMin(sh) * 60000);
    return { start: base, end };
  };
  /** Ventana de un turno en una fecha de producción (YYYY-MM-DD). */
  Shift.windowForDate = (sh, ymd) => {
    const d = U.parseYmd(ymd); d.setMinutes(Shift.startMin(sh));
    return { start: d, end: new Date(d.getTime() + Shift.durationMin(sh) * 60000) };
  };
  /** Horas visibles de una sesión: {slots:[{start,end,minutes,key}], hidden, noSchedule} */
  Shift.hours = (sh, startedAt, now = new Date(), max = 24) => {
    const slots = []; let noSchedule = false, start, end;
    if (Shift.hasSchedule(sh)) { const w = Shift.windowFor(sh, startedAt); start = w.start; end = w.end; }
    else { noSchedule = true; start = new Date(startedAt); start.setMinutes(0, 0, 0); end = new Date(now.getTime() + 36e5); }
    for (let t = start.getTime(); t < end.getTime() && t <= now.getTime(); t += 36e5) {
      const s = new Date(t), e = new Date(Math.min(t + 36e5, end.getTime()));
      slots.push({ start: s, end: e, minutes: Math.round((e - s) / 60000), key: s.toISOString() });
    }
    const hidden = Math.max(0, slots.length - max);
    return { slots: hidden ? slots.slice(hidden) : slots, hidden, noSchedule, all: slots };
  };
  Shift.slotLabel = (slot) => `${U.fmtTime(slot.start)}–${U.fmtTime(slot.end)}`;
})();
