/* pages-notices.js — Notices: programar reportes por correo (qué enviar, a quién, cuándo y en qué zona horaria) con vista previa del HTML y copiado para pegar en un correo. */
(function () {
  const G = (window.G = window.G || {});
  const U = G.U, UI = G.UI, db = G.db, esc = U.esc, $ = U.$;
  const NE = () => G.NoticeEmail;
  const st = { host: null, token: 0 };
  const canEdit = () => G.can('notices');
  const TZ = [['America/Mexico_City', 'Mexico City (CST)'], ['America/Monterrey', 'Monterrey (CST)'], ['America/Chihuahua', 'Chihuahua (CST)'], ['America/Tijuana', 'Tijuana (PST)'], ['America/New_York', 'New York (ET)'], ['America/Chicago', 'Chicago (CT)'], ['America/Denver', 'Denver (MT)'], ['America/Los_Angeles', 'Los Angeles (PT)'], ['America/Bogota', 'Bogotá (COT)'], ['America/Sao_Paulo', 'São Paulo (BRT)'], ['Europe/Madrid', 'Madrid (CET)'], ['UTC', 'UTC']];
  const TONE = { general: 'p-blue', quality: 'p-rose', production: 'p-green', custom: 'p-lilac' };
  const ICONS = ['dashboard', 'production', 'target', 'alert', 'clock', 'machines', 'parts', 'check', 'sparkles', 'barcode', 'layers', 'notices'];
  const COLORS = ['#0CC0DF', '#7C5CFF', '#1FB37A', '#E8A92B', '#E07A6B', '#6C87AE', '#E86FA5', '#0F1B2D'];
  const DEF_COLOR = { general: '#0CC0DF', quality: '#E07A6B', production: '#1FB37A', custom: '#7C5CFF' };
  const appearanceHTML = (n) => { const ic = n.icon || NE().REPORTS[n.report_type].icon, co = n.color || DEF_COLOR[n.report_type]; return `<div class="field" style="margin-top:14px"><span class="lbl">Icon and color</span><div class="appearance"><div class="icon-pick" role="radiogroup" aria-label="Icon">${ICONS.map((k) => `<label class="ip-opt"><input type="radio" name="icon" value="${k}" ${k === ic ? 'checked' : ''}><span>${UI.icon(k, 18)}</span></label>`).join('')}</div><div class="color-pick" role="radiogroup" aria-label="Color">${COLORS.map((c) => `<label class="cp-opt" style="--c:${c}"><input type="radio" name="color" value="${c}" ${c.toLowerCase() === co.toLowerCase() ? 'checked' : ''}><span></span></label>`).join('')}</div></div></div>`; };
  const contentHTML = (n) => { const sel = new Set(n.blocks || []), grp = (kind, title) => `<div class="blk-group"><b>${title}</b><div class="blk-list">${NE().BLOCKS.filter((b) => b[2] === kind).map((b) => `<label class="check blk"><input type="checkbox" name="blk" value="${b[0]}" ${sel.has(b[0]) ? 'checked' : ''}> <span>${esc(b[1])}</span></label>`).join('')}</div></div>`; return `<div class="field" id="nf-content" style="margin-top:14px" ${n.report_type === 'custom' ? '' : 'hidden'}><span class="lbl">What data to send<span class="req"> *</span></span><div class="blk-wrap">${grp('kpi', 'KPIs')}${grp('table', 'Tables and breakdowns')}</div><div class="btn-row"><button type="button" class="btn sm ghost" data-blk-all>Select all</button><button type="button" class="btn sm ghost" data-blk-none>Clear</button></div></div>`; };
  const blocksLine = (n) => { if (n.report_type !== 'custom') return ''; const lab = Object.fromEntries(NE().BLOCKS.map((b) => [b[0], b[1]])), b = (n.blocks || []).filter((x) => lab[x]); return `<div class="nc-blocks">${b.slice(0, 4).map((x) => `<span class="chip">${esc(lab[x])}</span>`).join('')}${b.length > 4 ? `<span class="chip">+${b.length - 4}</span>` : ''}${b.length ? '' : '<span class="muted small">Nothing selected</span>'}</div>`; };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parseRecipients = (txt) => String(txt || '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

  /* ---------- Copiar al portapapeles (HTML enriquecido y código) ---------- */
  async function copyRich(html, text) {
    try { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); return true; } } catch (e) { /* intenta el método alterno */ }
    const box = document.createElement('div'); box.contentEditable = 'true'; box.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px'; box.innerHTML = html; document.body.appendChild(box);
    const r = document.createRange(); r.selectNodeContents(box); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } sel.removeAllRanges(); box.remove(); return ok;
  }
  async function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* alterno */ }
    const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); return ok;
  }

  /* ---------- Vista previa del correo ---------- */
  async function openPreview(n) {
    const recips = n.recipients || [];
    const modal = UI.modal({ title: `Preview — ${n.name}`, subtitle: 'This is exactly how the email will look when it arrives.', size: 'xl', className: 'mail-modal', body: '<div class="state state-loading"><span class="spinner"></span><span>Building the report…</span></div>' });
    const nat = NE().periodFor(n.frequency);
    let period = nat, device = 'desktop', last = null, autoTried = false, autoNote = '';
    const paint = async () => {
      modal.setBody('<div class="state state-loading"><span class="spinner"></span><span>Building the report…</span></div>');
      try {
        last = await NE().build(n, period);
        if (!last.hasData && period === nat && !autoTried) {   // el periodo programado no tuvo producción (p. ej. domingo): muestra el periodo más reciente con datos
          autoTried = true;
          for (const k of ['lastweek', 'month', 'lastmonth']) { const alt = await NE().build(n, k); if (alt.hasData) { autoNote = `${NE().PERIODS.find((p) => p[0] === nat)[1]} had no production, so the preview shows ${NE().PERIODS.find((p) => p[0] === k)[1].toLowerCase()} instead.`; period = k; last = alt; break; } }
        }
        const when = new Date();
        modal.setBody(`<div class="mail-tools"><div class="field"><label for="mp-period">Data period</label><select id="mp-period">${NE().PERIODS.map(([k, l]) => `<option value="${k}"${k === period ? ' selected' : ''}>${l}${k === nat ? ' (scheduled)' : ''}</option>`).join('')}</select></div>
          <div class="tabs" role="tablist" aria-label="Device"><button class="tab${device === 'desktop' ? ' active' : ''}" data-dev="desktop">Desktop</button><button class="tab${device === 'mobile' ? ' active' : ''}" data-dev="mobile">Mobile</button></div>
          <div class="btn-row mail-copy"><button class="btn primary" id="mp-copy">${UI.icon('copy', 15)} Copy for email</button><button class="btn" id="mp-code">${UI.icon('copy', 15)} Copy HTML code</button></div></div>
          ${autoNote && last.hasData ? `<div class="notice">${UI.icon('clock', 16)}<span>${esc(autoNote)}</span></div>` : ''}${last.hasData ? '' : `<div class="notice warn">${UI.icon('alert', 16)}<span>There is no production in this period. Pick another period to see the report with data.</span></div>`}
          <div class="mail-sim"><div class="mail-head"><div class="mail-subject">${esc(last.subject)}</div><dl><div><dt>From</dt><dd>GUVEL Operational &lt;notices@guvel.app&gt;</dd></div><div><dt>To</dt><dd>${recips.length ? esc(recips.join(', ')) : '<span class="muted">No recipients yet</span>'}</dd></div><div><dt>Date</dt><dd>${esc(when.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</dd></div></dl></div>
          <div class="mail-canvas ${device}"><iframe class="mail-frame" title="Email preview" sandbox="allow-same-origin"></iframe></div></div>
          <p class="muted small" style="margin-top:10px">Tip: press <b>Copy for email</b>, open a new message in Outlook or Gmail and paste (Ctrl + V) to see it in your own mail client.</p>`);
        const fr = $('.mail-frame', modal.body); fr.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#EAF2F8">${last.html}</body></html>`;
        fr.onload = () => { try { fr.style.height = fr.contentDocument.documentElement.scrollHeight + 'px'; } catch (e) { fr.style.height = '900px'; } };
        $('#mp-period', modal.body).onchange = (e) => { period = e.target.value; paint(); };
        U.$$('[data-dev]', modal.body).forEach((b) => (b.onclick = () => { device = b.dataset.dev; paint(); }));
        $('#mp-copy', modal.body).onclick = async () => UI.toast((await copyRich(last.html, last.text)) ? 'Copied — paste it into an email message' : 'Your browser blocked copying. Use "Copy HTML code" instead.', 'ok');
        $('#mp-code', modal.body).onclick = async () => {
          if (await copyText(last.html)) { UI.toast('HTML code copied'); return; }
          const m2 = UI.modal({ title: 'Copy the HTML code', subtitle: 'Your browser blocked automatic copying. Select all and copy (Ctrl + C).', size: 'lg', body: `<textarea class="input" id="mp-src" rows="14" readonly style="font-family:monospace;font-size:12px;width:100%">${esc(last.html)}</textarea>`, footer: '<button class="btn primary" data-close>Done</button>' });
          const ta = $('#mp-src', m2.root); ta.focus(); ta.select();
        };
      } catch (e) { console.error(e); UI.error(modal.body, e, paint); }
    };
    await paint();
  }

  /* ---------- Formulario ---------- */
  function openForm(row) {
    const n = row || { name: '', report_type: 'general', frequency: 'daily', weekday: 1, month_day: 1, send_time: '07:00', timezone: 'America/Mexico_City', recipients: [], subject: '', active: true, icon: null, color: null, blocks: [], language: G.lang };
    const R = NE().REPORTS;
    const modal = UI.modal({ title: row ? 'Edit notice' : 'New notice', size: 'lg', body: `<form id="nf" novalidate>
      <div class="form-grid"><div class="field span-2"><label for="nf-name">Notice name<span class="req"> *</span></label><input id="nf-name" name="name" value="${esc(n.name)}" placeholder="e.g. Daily plant summary" autocomplete="off"></div></div>
      <div class="field" style="margin-top:14px"><span class="lbl">What to send<span class="req"> *</span></span><div class="report-pick">${Object.keys(R).map((k) => `<label class="report-opt tone-${TONE[k]}"><input type="radio" name="type" value="${k}" ${n.report_type === k ? 'checked' : ''}><span class="ro-ico">${UI.icon(R[k].icon, 18)}</span><span><b>${esc(R[k].label)}</b><small>${esc(R[k].desc)}</small></span></label>`).join('')}</div></div>
      ${appearanceHTML(n)}${contentHTML(n)}<div class="form-grid" style="margin-top:14px"><div class="field span-2"><label for="nf-rec">Recipients<span class="req"> *</span></label><textarea id="nf-rec" name="rec" rows="2" placeholder="name@company.com, other@company.com">${esc((n.recipients || []).join(', '))}</textarea><span class="hint">Separate emails with commas, semicolons or new lines.</span></div>
      <div class="field"><label for="nf-freq">How often</label><select id="nf-freq" name="freq">${Object.entries(NE().FREQ).map(([k, l]) => `<option value="${k}"${n.frequency === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field" id="nf-wd-f"><label for="nf-wd">Day of the week</label><select id="nf-wd" name="wd">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}"${Number(n.weekday) === d ? ' selected' : ''}>${NE().DAYS[d]}</option>`).join('')}</select></div>
      <div class="field" id="nf-md-f"><label for="nf-md">Day of the month</label><input id="nf-md" name="md" type="number" min="1" max="28" value="${n.month_day}"></div>
      <div class="field"><label for="nf-time">Send time</label><input id="nf-time" name="time" type="time" value="${esc(n.send_time)}"></div>
      <div class="field"><label for="nf-tz">Time zone</label><select id="nf-tz" name="tz">${TZ.map(([v, l]) => `<option value="${v}"${n.timezone === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="nf-lang">Email language</label><select id="nf-lang" name="lang"><option value="en"${(n.language || G.lang) === 'en' ? ' selected' : ''}>English</option><option value="es"${(n.language || G.lang) === 'es' ? ' selected' : ''}>Español</option></select></div><div class="field span-2"><label for="nf-sub">Subject <span class="muted">(optional)</span></label><input id="nf-sub" name="sub" value="${esc(n.subject)}" placeholder="Leave empty for an automatic subject" autocomplete="off"></div></div>
      <p class="notice" id="nf-cover" style="margin-top:14px"></p>
      <label class="check" style="margin-top:12px"><input type="checkbox" name="active" ${n.active ? 'checked' : ''}> <span><b>Active</b> — send this notice on schedule</span></label>
      <div class="form-error" hidden role="alert" style="margin-top:12px"></div></form>`, footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit" form="nf">${row ? 'Save changes' : 'Create notice'}</button>` });
    const f = $('#nf', modal.body), err = $('.form-error', f);
    const sync = () => { const fr = f.elements.freq.value; $('#nf-wd-f', f).hidden = fr !== 'weekly'; $('#nf-md-f', f).hidden = fr !== 'monthly'; $('#nf-cover', f).innerHTML = `${UI.icon('clock', 16)}<span>${fr === 'daily' ? 'Sent every day with <b>yesterday\'s</b> data.' : fr === 'weekly' ? 'Sent every week with the <b>previous week\'s</b> data.' : 'Sent every month with the <b>previous month\'s</b> data.'}</span>`; };
    f.elements.freq.onchange = sync; sync();
    let touched = !!(n.icon || n.color);
    const syncType = () => { const tp = f.elements.type.value; $('#nf-content', f).hidden = tp !== 'custom'; if (!touched) { const ic = NE().REPORTS[tp].icon; const ri = f.querySelector(`[name=icon][value="${ic}"]`), rc = f.querySelector(`[name=color][value="${DEF_COLOR[tp]}"]`); if (ri) ri.checked = true; if (rc) rc.checked = true; } };
    U.$$('[name=type]', f).forEach((r) => (r.onchange = syncType)); U.$$('[name=icon],[name=color]', f).forEach((r) => (r.onchange = () => { touched = true; })); syncType();
    $('[data-blk-all]', f).onclick = () => U.$$('[name=blk]', f).forEach((c) => (c.checked = true)); $('[data-blk-none]', f).onclick = () => U.$$('[name=blk]', f).forEach((c) => (c.checked = false));
    f.onsubmit = async (e) => {
      e.preventDefault(); err.hidden = true; const v = (k) => String(f.elements[k].value).trim(), recips = parseRecipients(v('rec')), bad = recips.filter((x) => !emailRe.test(x));
      const msg = !v('name') ? 'Give the notice a name.' : !recips.length ? 'Add at least one recipient email.' : bad.length ? `These emails are not valid: ${bad.join(', ')}` : !v('time') ? 'Choose the send time.' : f.elements.type.value === 'custom' && !U.$$('[name=blk]:checked', f).length ? 'Select at least one data block for the custom report.' : f.elements.freq.value === 'monthly' && !(Number(v('md')) >= 1 && Number(v('md')) <= 28) ? 'Pick a day of the month between 1 and 28.' : '';
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      const payload = { name: v('name'), report_type: f.elements.type.value, recipients: recips, frequency: v('freq'), weekday: Number(v('wd')), month_day: Number(v('md')) || 1, send_time: v('time'), timezone: v('tz'), subject: v('sub'), active: f.elements.active.checked, group_by_part: true, icon: (f.querySelector('[name=icon]:checked') || {}).value || null, color: (f.querySelector('[name=color]:checked') || {}).value || null, language: v('lang'), blocks: f.elements.type.value === 'custom' ? U.$$('[name=blk]:checked', f).map((c) => c.value) : [] };
      try { if (row) await db.update('notices', row.id, payload); else await db.insert('notices', { ...payload, last_sent_at: null }); UI.toast(row ? 'Notice updated' : 'Notice created'); modal.close(); draw(); } catch (e2) { err.textContent = UI.errMsg(e2); err.hidden = false; }
    };
  }

  /* ---------- Lista ---------- */
  async function draw() {
    const host = st.host; if (!host || !host.isConnected) return;
    const tk = ++st.token;
    try {
      const rows = await db.select('notices', { order: [['created_at', 'asc']] }); if (tk !== st.token) return;
      const R = NE().REPORTS, active = rows.filter((r) => r.active).length;
      host.innerHTML = `<div class="toolbar"><span class="chip">${rows.length} notice${rows.length === 1 ? '' : 's'}</span><span class="chip">${active} active</span><span class="muted small grow">Emails are simulated in this prototype — preview them and copy the result into a real message.</span>${canEdit() ? `<button class="btn primary" data-new>${UI.icon('plus', 16)} New notice</button>` : ''}</div>
        ${canEdit() ? '' : `<div class="notice" style="margin-bottom:14px">${UI.icon('alert', 16)}<span>You have view-only access to notices. You can still preview them.</span></div>`}
        ${rows.length ? `<div class="notice-grid">${rows.map((n) => `<article class="notice-card${n.active ? '' : ' paused'}" data-id="${n.id}"><header><span class="nc-ico tone-${TONE[n.report_type]}"${n.color ? ` style="--nc:${esc(n.color)}"` : ''}>${UI.icon(n.icon || R[n.report_type].icon, 20)}</span><div class="nc-title"><b>${esc(n.name)}</b><span class="muted small">${esc(R[n.report_type].label)}</span></div>${canEdit() ? `<label class="switch" title="${n.active ? 'Active' : 'Paused'}"><input type="checkbox" data-toggle ${n.active ? 'checked' : ''} aria-label="Active"><i></i></label>` : `<span class="badge ${n.active ? 'ok' : 'idle'}">${n.active ? 'Active' : 'Paused'}</span>`}</header>
          <dl class="nc-meta"><div><dt>Schedule</dt><dd>${esc(NE().when(n))}</dd></div><div><dt>Covers</dt><dd>${esc(NE().covers(n))}</dd></div><div><dt>Next send</dt><dd>${n.active ? esc(NE().fmtNext(n)) : '<span class="muted">Paused</span>'}</dd></div><div><dt>Last sent</dt><dd>${n.last_sent_at ? esc(U.fmtDateTime(n.last_sent_at)) : '<span class="muted">Never</span>'}</dd></div></dl>
          ${blocksLine(n)}<div class="nc-rec">${(n.recipients || []).slice(0, 3).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}${(n.recipients || []).length > 3 ? `<span class="chip">+${n.recipients.length - 3}</span>` : ''}</div>
          <div class="nc-actions"><button class="btn primary sm" data-prev>${UI.icon('eye', 14)} Preview</button><button class="btn sm" data-test>${UI.icon('send', 14)} Send test</button>${canEdit() ? `<button class="icon-btn" data-edit aria-label="Edit notice">${UI.icon('edit', 16)}</button><button class="icon-btn" data-del aria-label="Delete notice">${UI.icon('trash', 16)}</button>` : ''}</div></article>`).join('')}</div>`
        : '<div class="panel"><div class="state state-empty">' + UI.icon('notices', 28) + '<span>No notices yet. Create one to schedule a report by email.</span></div></div>'}`;
      const nb = $('[data-new]', host); if (nb) nb.onclick = () => openForm(null);
      host.onclick = async (e) => {
        const card = e.target.closest('.notice-card'); if (!card) return; const n = rows.find((x) => x.id === card.dataset.id);
        if (e.target.closest('[data-prev]')) openPreview(n);
        else if (e.target.closest('[data-edit]')) openForm(n);
        else if (e.target.closest('[data-del]')) { if (await UI.confirm({ title: `Delete “${n.name}”?`, message: 'This notice will stop being sent. This cannot be undone.', confirmLabel: 'Delete notice', danger: true })) { try { await db.delete('notices', n.id); UI.toast('Notice deleted'); draw(); } catch (er) { UI.toast(UI.errMsg(er), 'err'); } } }
        else if (e.target.closest('[data-test]')) { const b = await NE().build(n); try { await db.update('notices', n.id, { last_sent_at: new Date().toISOString() }); } catch (er) { /* sin permiso: solo simula */ } UI.toast(`Simulated: “${b.subject}” → ${(n.recipients || []).length} recipient${(n.recipients || []).length === 1 ? '' : 's'}`); draw(); }
      };
      host.onchange = async (e) => { const t = e.target.closest('[data-toggle]'); if (!t) return; const id = t.closest('.notice-card').dataset.id; try { await db.update('notices', id, { active: t.checked }); UI.toast(t.checked ? 'Notice activated' : 'Notice paused'); draw(); } catch (er) { UI.toast(UI.errMsg(er), 'err'); t.checked = !t.checked; } };
      const grid = $('.notice-grid', host); if (grid) UI.stagger(grid);   // sin avisos (empresa nueva) no hay cuadrícula
    } catch (e) { console.error(e); UI.error(host, e, draw); }
  }

  G.Pages.notices = { noStagger: true, async render(host) { st.host = host; await draw(); }, refresh() { return draw(); }, destroy() { st.token++; st.host = null; } };
})();
