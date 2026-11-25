/* cursor.js — cursor personalizado: círculo neón azul celeste, moderado; se desvanece tras 10 s sin mover el mouse.
   Solo en dispositivos con puntero fino; se puede desactivar en Settings → Preferences (G.Prefs 'cursor'). */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U;
  if (!window.matchMedia || !matchMedia('(pointer: fine)').matches) return;
  const IDLE_MS = 10000;
  const dot = U.el('<div class="neon-cursor" aria-hidden="true"><i></i></div>');
  let x = -100, y = -100, raf = 0, timer = 0, shown = false;
  const root = document.documentElement;
  const enabled = () => G.Prefs.s.cursor !== false;
  const host = () => document.fullscreenElement || document.body;   // en pantalla completa solo se pinta el subárbol del elemento
  const place = () => { raf = 0; dot.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
  const show = () => { if (!shown) { shown = true; dot.classList.add('on'); } clearTimeout(timer); timer = setTimeout(hide, IDLE_MS); };
  const hide = () => { shown = false; dot.classList.remove('on'); root.classList.add('cursor-idle'); };
  const apply = () => {
    const on = enabled();
    root.classList.toggle('neon-cursor-on', on); if (!on) { dot.classList.remove('on'); root.classList.remove('cursor-idle'); }
    if (on && dot.parentNode !== host()) host().appendChild(dot);
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    if (!enabled()) return;
    x = e.clientX; y = e.clientY; root.classList.remove('cursor-idle'); show();
    if (!raf) raf = requestAnimationFrame(place);
    dot.classList.toggle('link', !!(e.target.closest && e.target.closest('a,button,select,summary,label,[role=button],[data-go],.hex-cell,.machine-card,tr.clickable,.tab,.nav-item')));
    dot.classList.toggle('text', !!(e.target.closest && e.target.closest('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea')));
  }, { passive: true });
  document.addEventListener('pointerdown', () => { if (shown) dot.classList.add('press'); }, { passive: true });
  document.addEventListener('pointerup', () => dot.classList.remove('press'), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { dot.classList.remove('on'); shown = false; });
  document.addEventListener('fullscreenchange', apply);
  G.bus.on('prefs', apply);
  apply();
})();
