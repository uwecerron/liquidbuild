// AI design assistant chat box. Shown only when the server has ANTHROPIC_API_KEY (see /api/config).
(() => {
  const PHONE = '305-833-5025';
  const STARTERS = ['Remodel my kitchen', 'Add a second story', 'Build a home on my lot', 'Turn my garage into a room', 'Upload a photo of my space'];
  const KEY = 'lb-chat-v1';
  let state = { history: [], quoteSent: false, files: [] };
  try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.history)) state = { files: [], ...s }; } catch {}
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ ...state, history: state.history.map((m) => ({ ...m, images: m.images && m.images.length ? m.images.slice(-2) : undefined })) })); } catch {} };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function md(text) {
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n/);
    let html = '', list = null;
    for (const l of lines) {
      const m = l.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
      if (m) { const kind = m[1] ? 'ol' : 'ul'; if (list !== kind) { if (list) html += `</${list}>`; html += `<${kind}>`; list = kind; } html += `<li>${m[2]}</li>`; continue; }
      if (list) { html += `</${list}>`; list = null; }
      if (l.trim()) html += `<p>${l}</p>`;
    }
    return html + (list ? `</${list}>` : '');
  }

  const root = document.createElement('div');
  root.className = 'lbchat';
  root.innerHTML = `
    <button class="lbc-open" type="button" aria-expanded="false" aria-controls="lbc-panel">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      <span>Design with AI</span></button>
    <section class="lbc-panel" id="lbc-panel" role="dialog" aria-label="Liquid Build design assistant" hidden>
      <header><img src="/logo-mark.svg" alt="" width="32" height="32"><div><b>Design assistant</b><small>AI · ideas and ballparks, not bids</small></div>
        <button type="button" class="lbc-reset" title="Start over">New</button><button type="button" class="lbc-x" aria-label="Close">×</button></header>
      <div class="lbc-log" aria-live="polite"></div>
      <div class="lbc-start"></div>
      <form class="lbc-form">
        <div class="lbc-thumbs"></div>
        <div class="lbc-row">
          <button type="button" class="lbc-attach" aria-label="Add a photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z M12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
          <textarea rows="1" placeholder="Describe your project…" aria-label="Message"></textarea>
          <button type="submit" class="lbc-send" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <p class="lbc-fine">AI can make mistakes. A person confirms everything before any work. <a href="/privacy">Privacy</a></p>
      </form>
    </section>`;

  const $ = (s) => root.querySelector(s);
  const panel = $('.lbc-panel'), log = $('.lbc-log'), start = $('.lbc-start'), form = $('.lbc-form'), ta = $('textarea'), picker = $('input[type=file]'), thumbs = $('.lbc-thumbs'), openBtn = $('.lbc-open');
  let pending = []; // base64 jpegs for the next message
  let busy = false;

  function bubble(role, html, extra = '') {
    const d = document.createElement('div');
    d.className = 'lbc-msg ' + role + ' ' + extra;
    d.innerHTML = html;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  }
  function render() {
    log.innerHTML = '';
    bubble('assistant', md("Hi! I'm Liquid Build's AI design assistant. Tell me about your project, or send a photo of the space, and I'll help you shape it, ballpark it and plan the next steps."));
    for (const m of state.history) {
      const imgs = (m.images || []).map((b) => `<img src="data:image/jpeg;base64,${b}" alt="Your photo">`).join('');
      bubble(m.role, (imgs ? `<div class="lbc-imgs">${imgs}</div>` : '') + (m.role === 'assistant' ? md(m.text) : `<p>${esc(m.text)}</p>`));
      if (m.quote) bubble('note', `Sent to the team${m.quote.reference ? ' · ' + esc(m.quote.reference) : ''}. We reply within one business day.`);
    }
    start.hidden = state.history.length > 0;
  }
  start.innerHTML = STARTERS.map((s) => `<button type="button">${s}</button>`).join('');
  start.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (/photo/i.test(b.textContent)) return picker.click();
    ta.value = b.textContent; form.requestSubmit();
  });

  function open(v = true) {
    panel.hidden = !v; openBtn.setAttribute('aria-expanded', String(v)); root.classList.toggle('on', v);
    if (v) { render(); setTimeout(() => ta.focus(), 50); }
  }
  openBtn.addEventListener('click', () => open(panel.hidden));
  $('.lbc-x').addEventListener('click', () => { open(false); openBtn.focus(); });
  $('.lbc-reset').addEventListener('click', () => { state = { history: [], quoteSent: false, files: [] }; pending = []; thumbs.innerHTML = ''; save(); render(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) open(false); });
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-open-chat]'); if (t) { e.preventDefault(); open(true); if (t.dataset.openChat) { ta.value = t.dataset.openChat; } } });

  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

  // Photos: shrink in the browser before sending (faster, cheaper, private until they send).
  function shrink(file) {
    return new Promise((ok, bad) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob((blob) => { const r = new FileReader(); r.onload = () => ok({ b64: String(r.result).split(',')[1], blob }); r.readAsDataURL(blob); }, 'image/jpeg', 0.82);
      };
      img.onerror = () => bad(new Error('That photo type is not supported. Try a JPG or PNG.'));
      img.src = url;
    });
  }
  let cfg = {};
  let upLib = null;
  const loadUpload = () => (window.LBUpload ? Promise.resolve(window.LBUpload) : (upLib = upLib || new Promise((ok, bad) => { const s = document.createElement('script'); s.src = '/vendor/blob-upload.js'; s.onload = () => ok(window.LBUpload); s.onerror = bad; document.head.appendChild(s); })));
  picker.addEventListener('change', async () => {
    for (const f of [...picker.files].slice(0, 4 - pending.length)) {
      try {
        const { b64, blob } = await shrink(f);
        pending.push(b64);
        const t = document.createElement('img'); t.src = 'data:image/jpeg;base64,' + b64; t.alt = f.name; thumbs.appendChild(t);
        if (cfg.uploads) loadUpload().then((up) => up('quotes/chat-' + f.name.replace(/[^\w.\- ()]/g, '_').replace(/\.\w+$/, '') + '.jpg', blob, { access: 'private', handleUploadUrl: '/api/upload', contentType: 'image/jpeg' }))
          .then((b) => { state.files.push({ url: b.url, name: f.name, type: 'image/jpeg', size: blob.size }); save(); }).catch(() => {});
      } catch (err) { bubble('note', esc(err.message)); }
    }
    picker.value = '';
    start.hidden = true; ta.focus();
  });
  $('.lbc-attach').addEventListener('click', () => picker.click());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (busy || (!text && !pending.length)) return;
    const msg = { role: 'user', text: text || 'Here is a photo of the space.', images: pending.length ? pending : undefined };
    state.history.push(msg); pending = []; thumbs.innerHTML = ''; ta.value = ''; ta.style.height = 'auto'; start.hidden = true;
    render(); save();
    busy = true; const typing = bubble('assistant', '<span class="lbc-dots"><i></i><i></i><i></i></span>', 'typing');
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: state.history, quoteSent: state.quoteSent, files: state.files, page: location.pathname }) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || !out.ok) throw new Error(out.error || 'Something went wrong.');
      const reply = { role: 'assistant', text: out.reply };
      if (out.quote) { state.quoteSent = true; reply.quote = out.quote; if (window.gtag) gtag('event', 'generate_lead', { source: 'chat' }); }
      state.history.push(reply); save();
    } catch (err) {
      typing.remove(); bubble('note', esc(err.message) + ` You can also call or text <a href="tel:+13058335025">${PHONE}</a>.`); busy = false; return;
    }
    busy = false; render();
  });

  fetch('/api/config').then((r) => r.json()).then((c) => {
    cfg = c || {};
    if (!cfg.chat || location.pathname.startsWith('/crm')) { document.querySelectorAll('[data-open-chat], [data-open-chat-wrap]').forEach((el) => (el.hidden = true)); return; }
    document.body.appendChild(root);
    if (state.history.length && sessionStorage.getItem(KEY + '-open') === '1') open(true);
    openBtn.addEventListener('click', () => { try { sessionStorage.setItem(KEY + '-open', panel.hidden ? '0' : '1'); } catch {} });
  }).catch(() => {});
})();
