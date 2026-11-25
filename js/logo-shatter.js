/* logo-shatter.js — animación de fragmentación del logo (pantalla de cierre de sesión).
   El logo se parte en ~72 esquirlas triangulares que salen despedidas desde un punto de impacto, con onda de choque,
   y se reensamblan en bucle. Usa Web Animations API. Respeta "Reduce motion" (logo estático). */
(function () {
  const G = (window.G = window.G || {});
  const COLS = 6, ROWS = 6, CYCLE = 5600;

  /** Crea el logo fragmentado dentro de `host` y devuelve una función que lo detiene */
  G.logoShatter = (host) => {
    if (!G.Prefs.motion()) { host.innerHTML = G.UI.logo(); return () => {}; }
    const rnd = (a, b) => a + Math.random() * (b - a);
    // rejilla de vértices con jitter (los bordes quedan rectos) → triángulos irregulares tipo cristal roto
    const V = [];
    for (let r = 0; r <= ROWS; r++) { V[r] = []; for (let c = 0; c <= COLS; c++) {
      const edgeX = c === 0 || c === COLS, edgeY = r === 0 || r === ROWS;
      V[r][c] = [c / COLS * 100 + (edgeX ? 0 : rnd(-6, 6)), r / ROWS * 100 + (edgeY ? 0 : rnd(-6, 6))];
    } }
    const tris = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const a = V[r][c], b = V[r][c + 1], d = V[r + 1][c], e = V[r + 1][c + 1];
      if (Math.random() < 0.5) { tris.push([a, b, d]); tris.push([b, e, d]); } else { tris.push([a, b, e]); tris.push([a, e, d]); }
    }
    const impact = [rnd(30, 70), rnd(30, 70)], logo = G.UI.logo();
    host.classList.add('shatter');
    host.innerHTML = tris.map((t) => `<span class="shard" style="clip-path:polygon(${t.map((p) => p[0].toFixed(1) + '% ' + p[1].toFixed(1) + '%').join(',')})">${logo}</span>`).join('');
    const anims = [];
    host.querySelectorAll('.shard').forEach((el, i) => {
      const t = tris[i], cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const dx = cx - impact[0], dy = cy - impact[1], dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) + rnd(-0.35, 0.35);
      const far = rnd(70, 210) * (1.15 - Math.min(dist, 70) / 120), tx = Math.cos(ang) * far, ty = Math.sin(ang) * far + rnd(-10, 40);   // la gravedad las baja un poco
      const rot = rnd(-260, 260), s = rnd(0.2, 0.7), norm = Math.min(dist / 70, 1);
      const o1 = 0.3 + norm * 0.06, o2 = o1 + 0.3, o3 = 0.74 + norm * 0.05, o4 = Math.min(o3 + 0.2, 0.99);                // inicio/fin de salida y de reensamblado
      const home = { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, filter: 'brightness(1)' };
      const kf = [
        Object.assign({ offset: 0 }, home), Object.assign({ offset: o1, easing: 'cubic-bezier(.12,.7,.3,1)' }, home),
        { offset: o1 + 0.03, transform: `translate(${(tx * 0.08).toFixed(1)}px,${(ty * 0.08).toFixed(1)}px) rotate(${(rot * 0.05).toFixed(1)}deg) scale(1.04)`, opacity: 1, filter: 'brightness(2.2) saturate(1.5)', easing: 'cubic-bezier(.1,.6,.3,1)' },
        { offset: o2, transform: `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${s.toFixed(2)})`, opacity: 0, filter: 'brightness(1.6)' },
        { offset: o3, transform: `translate(${(tx * 0.55).toFixed(1)}px,${(ty * 0.55).toFixed(1)}px) rotate(${(-rot * 0.5).toFixed(1)}deg) scale(${(s * 0.8).toFixed(2)})`, opacity: 0, filter: 'brightness(1.6)', easing: 'cubic-bezier(.3,.1,.2,1)' },
        { offset: o4, transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, filter: 'brightness(1.5)' },
        Object.assign({ offset: 1 }, home)
      ];
      anims.push(el.animate(kf, { duration: CYCLE, iterations: Infinity }));
    });
    host.style.setProperty('--ix', impact[0] + '%'); host.style.setProperty('--iy', impact[1] + '%');
    return () => anims.forEach((a) => { try { a.cancel(); } catch (e) { /* ya detenida */ } });
  };
})();
