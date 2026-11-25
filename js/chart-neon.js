/* chart-neon.js — plugin de Chart.js: un punto neón del color de la gráfica recorre la línea siguiendo su forma (con estela).
   En barras sube por cada barra de abajo hacia arriba. Velocidad y forma configurables desde el engrane de cada gráfica
   (G.ChartCfg.get(key).neon = { speed: slow|normal|fast, shape: circle|diamond|x|star|triangle|none }). Respeta "Reduce motion".
   Uso: plugins: [G.neonDot('#0CC0DF', 'oee')] */
(function () {
  const G = (window.G = window.G || {});
  const PAUSE_MS = 700, TRAIL = 16;
  G.NEON = { speeds: { slow: 9000, normal: 5200, fast: 2600 }, shapes: ['circle', 'diamond', 'x', 'star', 'triangle', 'none'], def: { speed: 'normal', shape: 'circle' } };

  const points = (ch) => {
    const meta = ch.getDatasetMeta(0); if (!meta || !meta.data) return [];
    return meta.data.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && !p.skip);
  };
  const bez = (a, b, u, curved) => {
    if (!curved || a.cp2x == null || b.cp1x == null) return [a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u];
    const v = 1 - u, c0 = v * v * v, c1 = 3 * v * v * u, c2 = 3 * v * u * u, c3 = u * u * u;
    return [c0 * a.x + c1 * a.cp2x + c2 * b.cp1x + c3 * b.x, c0 * a.y + c1 * a.cp2y + c2 * b.cp1y + c3 * b.y];
  };
  /** Línea: posición a lo largo de toda la polilínea/curva en t ∈ [0,1] (tiempo proporcional a la longitud) */
  const at = (pts, t, curved) => {
    if (pts.length === 1) return [pts[0].x, pts[0].y];
    const len = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) || 0.0001; len.push(d); tot += d; }
    let target = t * tot;
    for (let i = 0; i < len.length; i++) { if (target <= len[i] || i === len.length - 1) return bez(pts[i], pts[i + 1], Math.max(0, Math.min(1, target / len[i])), curved); target -= len[i]; }
    return [pts[pts.length - 1].x, pts[pts.length - 1].y];
  };
  /** Barras: cada barra se recorre de su base a su punta; el tiempo se reparte igual entre barras. Devuelve [x, y, índiceBarra] */
  const atBars = (pts, t, ch) => {
    const n = pts.length, f = Math.max(0, Math.min(0.99999, t)) * n, i = Math.floor(f), u = f - i, p = pts[i];
    const base = Number.isFinite(p.base) ? p.base : ch.scales.y.getPixelForValue(0), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;   // suave
    return [p.x, base + (p.y - base) * e, i];
  };

  /** Dibuja una figura centrada en (cx, cy) con radio r */
  function shapePath(x, cx, cy, r, shape) {
    x.beginPath();
    if (shape === 'diamond') { x.moveTo(cx, cy - r * 1.25); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r * 1.25); x.lineTo(cx - r, cy); x.closePath(); }
    else if (shape === 'triangle') { x.moveTo(cx, cy - r * 1.2); x.lineTo(cx + r * 1.1, cy + r * 0.85); x.lineTo(cx - r * 1.1, cy + r * 0.85); x.closePath(); }
    else if (shape === 'star') { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.5 : r * 1.3; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); }
    else x.arc(cx, cy, r, 0, Math.PI * 2);
  }
  function drawMark(x, cx, cy, r, shape, color, blur, alpha, core) {
    x.globalAlpha = alpha; x.shadowColor = color; x.shadowBlur = blur;
    if (shape === 'none') {                                           // solo haz de luz (halo radial)
      const R = r * 3.2, g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, color); g.addColorStop(0.35, color + '88'); g.addColorStop(1, color + '00');
      x.shadowBlur = 0; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
    } else if (shape === 'x') {
      x.strokeStyle = color; x.lineWidth = Math.max(1.6, r * 0.6); x.lineCap = 'round'; const d = r * 1.05;
      x.beginPath(); x.moveTo(cx - d, cy - d); x.lineTo(cx + d, cy + d); x.moveTo(cx + d, cy - d); x.lineTo(cx - d, cy + d); x.stroke();
    } else { x.fillStyle = color; shapePath(x, cx, cy, r, shape); x.fill(); }
    if (core) {                                                        // núcleo brillante
      x.globalAlpha = 1; x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, shape === 'none' ? 2.6 : 2.2, 0, Math.PI * 2); x.fill();
    }
  }

  G.neonDot = (color, key) => {
    const st = { t0: 0, raf: 0, started: false };
    const cfg = () => Object.assign({}, G.NEON.def, ((key && G.ChartCfg && G.ChartCfg.get(key)) || {}).neon || {});
    return {
      id: 'neonDot',
      afterInit(ch) {
        if (!G.Prefs.motion()) return;
        const c = ch.canvas;
        setTimeout(() => {                                 // arranca cuando termina la animación de entrada
          st.started = true; st.t0 = performance.now();
          const loop = (now) => {
            if (!ch.canvas || !ch.canvas.isConnected || !G.Prefs.motion()) { st.started = false; return; }
            const sp = cfg().speed, r = c.getBoundingClientRect(), L = (G.NEON.speeds[sp] || G.NEON.speeds.normal) * (ch.config.type === 'bar' && sp === 'slow' ? 2 : 1);   // barras: "Lento" es el doble de lento
            if (r.bottom > 0 && r.top < innerHeight && !document.hidden) { st.t = ((now - st.t0) % (L + PAUSE_MS)) / L; ch.draw(); }   // solo se redibuja si está a la vista
            st.raf = requestAnimationFrame(loop);
          };
          st.raf = requestAnimationFrame(loop);
        }, 900);
      },
      afterDatasetsDraw(ch) {
        if (!st.started || st.t == null || st.t > 1) return;
        const pts = points(ch); if (pts.length < 1) return;
        const o = cfg(), isBar = ch.config.type === 'bar', curved = !isBar && (ch.data.datasets[0].tension || 0) > 0, x = ch.ctx, a = ch.chartArea;
        const pos = (tt) => (isBar ? atBars(pts, tt, ch) : at(pts, tt, curved));
        x.save(); x.beginPath(); x.rect(a.left - 10, a.top - 10, a.right - a.left + 20, a.bottom - a.top + 20); x.clip();
        const head = pos(st.t), step = isBar ? 0.012 : 0.006;
        for (let i = TRAIL; i >= 1; i--) {                  // estela: puntos anteriores cada vez más tenues y pequeños
          const tt = st.t - i * step; if (tt < 0) continue; const p = pos(tt); if (isBar && p[2] !== head[2]) continue;   // en barras la estela no salta de una a otra
          const k = 1 - i / (TRAIL + 1); drawMark(x, p[0], p[1], 4 * k, o.shape, color, 9 * k, 0.5 * k * k, false);
        }
        drawMark(x, head[0], head[1], 5.5, o.shape, color, 20, 1, true);
        x.restore();
      },
      beforeDestroy() { cancelAnimationFrame(st.raf); st.started = false; }
    };
  };
})();
