/* ramiro.js — Ramiro AI: avatar GIF con ojos que siguen el cursor, panel de chat y abanico de insights.
   El "cerebro" (motor local de conversación) vive en ramiro-brain.js. Identidad fija; solo cambia el conocimiento del portal. */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, esc = U.esc, $ = U.$;
  const motion = () => G.Prefs.motion();
  const orbHTML = () => '<span class="ramiro-orb"><span class="ramiro-face"><img src="assets/ramiro.gif" alt="" draggable="false"><b class="eye l"><i></i></b><b class="eye r"><i></i></b></span></span>';

  /* ---------- Ojos vivos: siguen el cursor, parpadean y miran con curiosidad ---------- */
  const Eyes = {
    mx: -1, my: -1, raf: 0, last: Date.now(),
    start() {
      document.addEventListener('pointermove', (e) => { this.mx = e.clientX; this.my = e.clientY; this.last = Date.now(); this.queue(); }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => { this.mx = -1; this.queue(); });
      window.addEventListener('blur', () => { this.mx = -1; this.queue(); });
      G.bus.on('prefs', () => this.apply());
      const blink = () => {
        if (motion()) U.$$('.ramiro-orb').forEach((o) => { o.classList.add('blink'); setTimeout(() => o.classList.remove('blink'), 140); });
        setTimeout(blink, 2600 + Math.random() * 3600);
      };
      setTimeout(blink, 2000);
      setInterval(() => {                                   // curiosidad: el mouse lleva > 6 s quieto
        if (!motion() || Date.now() - this.last < 6000) return;
        const a = Math.random() * Math.PI * 2;
        U.$$('.ramiro-orb').forEach((o) => { const t = o.getBoundingClientRect().width * 0.055; o.style.setProperty('--ex', (Math.cos(a) * t).toFixed(2) + 'px'); o.style.setProperty('--ey', (Math.sin(a) * t * 0.7).toFixed(2) + 'px'); });
      }, 3500);
    },
    queue() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.apply(); }); },
    apply() {
      U.$$('.ramiro-orb').forEach((o) => {
        if (!motion() || this.mx < 0) { ['--ex', '--ey', '--fx', '--fy'].forEach((p) => o.style.setProperty(p, '0px')); return; }
        const r = o.getBoundingClientRect(); if (!r.width) return;
        const dx = this.mx - (r.left + r.width / 2), dy = this.my - (r.top + r.height / 2), dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / 220), t = r.width * 0.055;
        o.style.setProperty('--ex', (dx / dist * k * t).toFixed(2) + 'px'); o.style.setProperty('--ey', (dy / dist * k * t * 0.8).toFixed(2) + 'px');
        o.style.setProperty('--fx', (dx / dist * k * t * 0.35).toFixed(2) + 'px'); o.style.setProperty('--fy', (dy / dist * k * t * 0.3).toFixed(2) + 'px');
      });
    }
  };

  const Ramiro = (G.Ramiro = {
    el: null, btn: null, started: false, busy: false, ctx: { machine: null, part: null },
    build() {
      this.btn = U.el(`<button class="ramiro" id="ramiro" aria-label="${G.L('Pregúntale a Ramiro AI', 'Ask Ramiro AI')}" hidden>${orbHTML()}<span>${G.L('Pregúntale a Ramiro AI', 'Ask Ramiro AI')}</span></button>`);
      this.el = U.el(`<section class="ramiro-panel" id="ramiro-panel" role="dialog" aria-label="Ramiro AI" hidden>
        <div class="ramiro-top">${orbHTML()}<div><b>Ramiro AI</b><small id="ramiro-st">${G.L('En línea · lista para ayudarte', 'Online · ready to help')}</small></div><button class="icon-btn" id="ramiro-x" aria-label="${G.L('Cerrar', 'Close')}">${UI.icon('x')}</button></div>
        <div class="ramiro-body" id="ramiro-body"></div>
        <form class="ramiro-ask" id="ramiro-form"><input id="ramiro-in" placeholder="${G.L('Pregúntale algo a Ramiro AI…', 'Ask Ramiro AI anything…')}" autocomplete="off" aria-label="${G.L('Pregúntale a Ramiro AI', 'Ask Ramiro AI')}"><button aria-label="${G.L('Enviar', 'Send')}">${UI.icon('check')}</button></form></section>`);
      document.body.appendChild(this.btn); document.body.appendChild(this.el);
      this.btn.onclick = () => this.toggle();
      $('#ramiro-x', this.el).onclick = () => this.toggle(false);
      $('#ramiro-form', this.el).onsubmit = (e) => { e.preventDefault(); const i = $('#ramiro-in', this.el), q = i.value.trim(); if (q) { i.value = ''; this.ask(q); } };
      this.el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-q]'); if (c) { this.ask(c.dataset.q); return; }
        const m = e.target.closest('[data-m]'); if (m) this.ctx.machine = m.dataset.m;
        const p = e.target.closest('[data-p]'); if (p) this.ctx.part = p.dataset.p;
        const g = e.target.closest('[data-go]'); if (g) { G.Router.go(g.dataset.go); this.toggle(false); }
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !this.el.hidden && !UI.hasModal()) this.toggle(false); });
      G.bus.on('login', () => { this.btn.hidden = false; this.started = false; this.ctx = { machine: null, part: null }; });
      G.bus.on('logout', () => { this.btn.hidden = true; this.toggle(false); });
      Eyes.start();
    },
    async render() {
      const first = (G.user && G.user.name) || G.L('amigo', 'friend'), body = $('#ramiro-body', this.el);
      body.innerHTML = `<div class="msg bot">${G.L(`¡Hola, ${esc(first)}! Soy Ramiro AI 🐾 Te cuento lo que veo en planta; pasa el cursor sobre las tarjetas para abrirlas.`, `Hi, ${esc(first)}! I'm Ramiro AI 🐾 Here is what I see in the plant — hover over the cards to open them.`)}</div><div class="fan" id="ramiro-fan"><div class="typing"><i></i><i></i><i></i></div></div><div class="chips-q" id="ramiro-chips"></div><div id="ramiro-log" style="display:grid;gap:10px"></div>`;
      this.started = true; this.chips(G.RamiroBrain.sectionChips(), $('#ramiro-chips', this.el));
      try { const ins = await G.RamiroBrain.insights(); $('#ramiro-fan', this.el).innerHTML = ins.map((i, n) => `<button class="ins" data-c="${n}" data-go="${esc(i[0])}"><b>${esc(i[1])}</b><span>${esc(i[2])}</span></button>`).join(''); }
      catch (e) { console.error(e); const f = $('#ramiro-fan', this.el); if (f) f.remove(); }
    },
    /** Cambio de idioma: actualiza textos del botón y del panel y reinicia la conversación */
    resetLang() {
      if (!this.el) return; const L = G.L;
      this.btn.setAttribute('aria-label', L('Pregúntale a Ramiro AI', 'Ask Ramiro AI')); this.btn.innerHTML = `${orbHTML()}<span>${L('Pregúntale a Ramiro AI', 'Ask Ramiro AI')}</span>`;
      $('#ramiro-st', this.el).textContent = L('En línea · lista para ayudarte', 'Online · ready to help'); $('#ramiro-x', this.el).setAttribute('aria-label', L('Cerrar', 'Close'));
      const i = $('#ramiro-in', this.el); i.placeholder = L('Pregúntale algo a Ramiro AI…', 'Ask Ramiro AI anything…'); i.setAttribute('aria-label', L('Pregúntale a Ramiro AI', 'Ask Ramiro AI')); $('#ramiro-form button', this.el).setAttribute('aria-label', L('Enviar', 'Send'));
      this.started = false; $('#ramiro-body', this.el).innerHTML = ''; this.ctx = { machine: null, part: null }; if (!this.el.hidden) this.render();
    },
    chips(list, host) { host.innerHTML = list.map((t) => `<button type="button" data-q="${esc(t)}">${esc(t)}</button>`).join(''); },
    say(html, me, chips) {
      const log = $('#ramiro-log', this.el), body = $('#ramiro-body', this.el);
      log.insertAdjacentHTML('beforeend', `<div class="msg ${me ? 'me' : 'bot'}">${html}</div>${chips && chips.length ? '<div class="chips-q"></div>' : ''}`);
      if (chips && chips.length) this.chips(chips, log.lastElementChild);
      body.scrollTop = body.scrollHeight;
    },
    talk(on) { this.btn.classList.toggle('talking', on); this.el.classList.toggle('talking', on); $('#ramiro-st', this.el).textContent = on ? G.L('Pensando…', 'Thinking…') : G.L('En línea · lista para ayudarte', 'Online · ready to help'); },
    async ask(q) {
      if (!this.started) await this.render();
      this.say(esc(q), true);
      const log = $('#ramiro-log', this.el), body = $('#ramiro-body', this.el);
      const t = U.el(`<div class="typing" aria-label="${G.L('Ramiro AI está escribiendo', 'Ramiro AI is typing')}"><i></i><i></i><i></i></div>`); log.appendChild(t); body.scrollTop = body.scrollHeight;
      this.talk(true);
      let r; const t0 = Date.now();
      try { r = await G.RamiroBrain.reply(q); } catch (err) { console.error(err); r = { html: G.L('Uy, algo me hizo tropezar 🐾 ¿Me lo preguntas de otra forma?', 'Oops, I tripped over that one 🐾 Could you ask it another way?'), chips: [G.L('¿Qué puedes hacer?', 'What can you do?')] }; }
      const wait = motion() ? Math.max(0, 600 + Math.min(r.html.length * 5, 800) - (Date.now() - t0)) : 0;
      setTimeout(() => { t.remove(); this.say(r.html, false, r.chips); this.talk(false); if (r.after) r.after(); }, wait);
    },
    open(q) { this.toggle(true); if (q) setTimeout(() => this.ask(q), 120); },
    toggle(force) {
      if (!G.user) return;
      const show = typeof force === 'boolean' ? force : this.el.hidden;
      if (show && !this.started) this.render();
      this.el.hidden = !show; this.btn.setAttribute('aria-expanded', String(show));
      if (show) setTimeout(() => $('#ramiro-in', this.el).focus(), 60);
    }
  });
  Ramiro.orbHTML = orbHTML;
  Ramiro.build();
})();
