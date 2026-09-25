// Quote forms. The main form is a 4-step flow (.qf). Other forms (Spanish page) post in one go.
// Without JavaScript every step shows and the form posts normally to /api/quote.
let SITE_CONFIG = fetch('/api/config').then((r) => r.json()).catch(() => ({}));

function setPage(form) {
  const page = form.querySelector('input[name="page"]');
  if (page) page.value = (location.pathname + location.search).slice(0, 300);
}

async function sendQuote(form, data) {
  const res = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(out.error || 'Something went wrong.');
  return out;
}

document.querySelectorAll('form[data-quote]:not(.qf)').forEach((form) => {
  setPage(form);
  const status = form.querySelector('.form-status');
  const btn = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status'; status.textContent = form.dataset.sending || 'Sending…'; btn.disabled = true;
    try {
      await sendQuote(form, Object.fromEntries(new FormData(form).entries()));
      form.reset(); setPage(form);
      status.className = 'form-status ok'; status.textContent = form.dataset.thanks || 'Thanks, we got it. We reply within one business day.';
    } catch (err) {
      status.className = 'form-status err'; status.textContent = (err && err.message ? err.message + ' ' : '') + 'You can also call 305-833-5025.';
    } finally { btn.disabled = false; }
  });
});

document.querySelectorAll('form.qf').forEach((form) => {
  setPage(form);
  const steps = [...form.querySelectorAll('.qf-step')];
  const top = form.querySelector('.qf-top');
  const count = form.querySelector('.qf-count');
  const bar = form.querySelector('.qf-bar i');
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('button[type="submit"]');
  const files = []; // { name, size, type, url, state }
  let uploading = 0;
  let current = 0;
  form.classList.add('js');
  top.hidden = false;

  const val = (n) => { const el = form.querySelector(`[name="${n}"]:checked`) || form.elements[n]; return el ? el.value : ''; };
  const intent = () => val('intent');

  function showWhen() {
    const i = intent() || 'price';
    form.querySelectorAll('.qf-when').forEach((el) => (el.hidden = el.dataset.when !== i));
  }

  function go(n, focus = true) {
    current = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach((s, i) => { s.hidden = i !== current; });
    count.textContent = `Step ${current + 1} of ${steps.length}`;
    bar.style.width = ((current + 1) / steps.length) * 100 + '%';
    const picked = form.querySelector('.qf-picked');
    picked.hidden = current === 0 || !val('project');
    if (!picked.hidden) { picked.textContent = val('project') + ' · '; const c = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Change' }); c.onclick = () => go(0); picked.appendChild(c); }
    showWhen();
    if (focus) {
      const leg = steps[current].querySelector('legend');
      leg.setAttribute('tabindex', '-1'); leg.focus({ preventScroll: true });
      const r = form.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.6) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Messages show in the step you're on.
  steps.forEach((s) => { if (!s.contains(status)) s.querySelector('.qf-nav').after(Object.assign(document.createElement('p'), { className: 'form-status step-msg', role: 'status' })); });
  const msgIn = (i) => steps[i].querySelector('.form-status');
  function needHere(msg) { const m = msgIn(current); m.className = 'form-status err'; m.textContent = msg; }

  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) {
      const ok = current === 0 ? !!val('project') : current === 1 ? !!val('intent') : true;
      if (!ok) return needHere(current === 0 ? 'Pick what you are building.' : 'Pick where you are starting from.');
      msgIn(current).textContent = '';
      go(current + 1);
    }
    if (e.target.closest('[data-back]')) go(current - 1);
    const ex = e.target.closest('[data-example]');
    if (ex) { const t = form.elements.idea; t.value = ex.textContent; t.focus(); }
  });

  // Tapping a card moves you forward: fewer clicks, same result.
  form.querySelectorAll('input[name="project"], input[name="intent"]').forEach((r) =>
    r.addEventListener('change', () => { msgIn(current).textContent = ''; setTimeout(() => go(current + 1), 180); }));

  // Enter in a text field goes to the next step instead of submitting early.
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && current < steps.length - 1) { e.preventDefault(); form.querySelector('.qf-step:not([hidden]) [data-next]').click(); }
  });

  // ---------- Uploads ----------
  const drop = form.querySelector('[data-drop]');
  const picker = form.querySelector('[data-file]');
  const list = form.querySelector('[data-files]');
  const noUpload = form.querySelector('[data-noupload]');
  let uploadsOn = null;
  SITE_CONFIG.then((c) => { uploadsOn = !!(c && c.uploads); if (!uploadsOn) { drop.hidden = true; noUpload.hidden = false; } });

  let libReady = null;
  function lib() {
    if (window.LBUpload) return Promise.resolve(window.LBUpload);
    if (!libReady) libReady = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = '/vendor/blob-upload.js'; s.onload = () => ok(window.LBUpload); s.onerror = bad; document.head.appendChild(s); });
    return libReady;
  }
  const kb = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');
  const EXT_TYPE = { dwg: 'image/vnd.dwg', dxf: 'image/vnd.dxf', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };

  function render() {
    list.innerHTML = '';
    files.forEach((f, i) => {
      const li = document.createElement('li');
      li.className = f.state;
      li.innerHTML = '<span class="fname"></span><span class="fmeta"></span><button type="button" aria-label="Remove">×</button>';
      li.querySelector('.fname').textContent = f.name;
      li.querySelector('.fmeta').textContent = f.state === 'up' ? (f.pct || 0) + '%' : f.state === 'err' ? f.err : kb(f.size);
      li.querySelector('button').onclick = () => { files.splice(i, 1); render(); };
      list.appendChild(li);
    });
    form.elements.files.value = JSON.stringify(files.filter((f) => f.state === 'done').map(({ url, name, size, type }) => ({ url, name, size, type })));
  }

  async function add(fileList) {
    if (!uploadsOn) return;
    for (const file of [...fileList].slice(0, 20 - files.length)) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const type = file.type || EXT_TYPE[ext] || '';
      const f = { name: file.name, size: file.size, type, state: 'up', pct: 0 };
      files.push(f); render();
      if (file.size > 50 * 1024 * 1024) { f.state = 'err'; f.err = 'Over 50 MB'; render(); continue; }
      if (!type) { f.state = 'err'; f.err = 'File type not supported'; render(); continue; }
      uploading++; submit.disabled = true;
      try {
        const upload = await lib();
        const safe = file.name.replace(/[^\w.\- ()]/g, '_').slice(-120);
        const blob = await upload('quotes/' + safe, file, {
          access: 'private', handleUploadUrl: '/api/upload', contentType: type, multipart: file.size > 8 * 1024 * 1024,
          onUploadProgress: (p) => { f.pct = Math.round(p.percentage); render(); },
        });
        Object.assign(f, { url: blob.url, state: 'done' });
      } catch (err) {
        f.state = 'err'; f.err = /content type/i.test(err.message) ? 'File type not supported' : 'Upload failed, try again';
      }
      uploading--; submit.disabled = uploading > 0; render();
    }
  }
  drop.addEventListener('click', () => picker.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } });
  picker.addEventListener('change', () => { add(picker.files); picker.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => add(e.dataTransfer.files));

  // ---------- Shape my idea ----------
  const planBox = form.querySelector('[data-plan]');
  form.querySelector('[data-shape]').addEventListener('click', async () => {
    const idea = form.elements.idea.value.trim();
    planBox.hidden = false;
    if (idea.length < 8) { planBox.innerHTML = '<p class="err-text">Tell us a little more first.</p>'; return; }
    planBox.innerHTML = '<p class="muted">Working it out…</p>';
    try {
      const r = await fetch('/api/ground', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea, project: val('project'), location: form.elements.location.value, timeline: val('timeline') }) }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || 'No plan');
      const est = typeof r.ballpark_estimate === 'object' ? r.ballpark_estimate.range : null;
      const li = (a, n) => a.slice(0, n).map((x) => '<li></li>').join('');
      planBox.innerHTML = `<p class="plan-sum"></p>${est ? '<p class="plan-est"></p>' : ''}
        <div class="plan-cols"><div><h4>Steps</h4><ol>${li(r.phases, 6)}</ol></div><div><h4>Permits you'll likely need</h4><ul>${li(r.likely_permits_and_approvals, 4)}</ul></div></div>
        <h4>We'll help you decide</h4><ul class="plan-q">${li(r.questions_to_answer_next, 3)}</ul>
        <p class="small muted">A starting point, not a bid. We confirm everything on a call or site visit.</p>`;
      planBox.querySelector('.plan-sum').textContent = r.summary;
      if (est) planBox.querySelector('.plan-est').textContent = 'Ballpark: ' + est;
      const fill = (sel, arr, fmt) => planBox.querySelectorAll(sel + ' li').forEach((el, i) => (el.textContent = fmt(arr[i])));
      fill('.plan-cols ol', r.phases, (p) => p.phase + ' (' + p.typical_duration + ')');
      fill('.plan-cols ul', r.likely_permits_and_approvals, (x) => x);
      fill('.plan-q', r.questions_to_answer_next, (x) => x);
      form.elements.plan.value = [r.summary, est && 'Ballpark: ' + est, 'Steps: ' + r.phases.map((p) => p.phase).join(', ')].filter(Boolean).join('\n');
    } catch { planBox.innerHTML = '<p class="muted">We could not shape that automatically. Send it anyway and we will call you.</p>'; }
  });

  // ---------- Submit ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (current < steps.length - 1) return form.querySelector('.qf-step:not([hidden]) [data-next]').click();
    if (uploading) return needHere('Hang on, files are still uploading.');
    const name = form.elements.name.value.trim(), phone = form.elements.phone.value.replace(/\D/g, '');
    if (!name) return needHere('Please add your name.'), form.elements.name.focus();
    if (phone.length < 10) return needHere('Please add a phone number we can reach.'), form.elements.phone.focus();
    if (val('contact_pref') === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value.trim())) return needHere('Add your email so we can write back.'), form.elements.email.focus();
    status.className = 'form-status'; status.textContent = 'Sending…'; submit.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const out = await sendQuote(form, data);
      const first = name.split(/\s+/)[0];
      const done = form.querySelector('[data-done]');
      steps.forEach((s) => (s.hidden = true)); top.hidden = true;
      done.hidden = false;
      done.innerHTML = `<h3></h3><p class="muted ref"></p><ol class="next-steps"><li></li><li>We review it and call you within one business day.</li><li>Next is a site visit or a video call, then a written estimate.</li></ol>
        <p class="small muted">Need us sooner? Call or text <a href="tel:+13058335025">305-833-5025</a>.</p>`;
      done.querySelector('h3').textContent = `Got it, ${first}.`;
      done.querySelector('.ref').textContent = (out.reference ? 'Your reference is ' + out.reference + '. ' : '') + (files.some((f) => f.state === 'done') ? files.filter((f) => f.state === 'done').length + ' file(s) attached.' : '');
      done.querySelector('li').textContent = out.texted ? 'Check your phone. We just sent you a text.' : 'You will hear from us by ' + ({ text: 'text', call: 'phone', email: 'email' }[val('contact_pref')] || 'phone') + '.';
      done.focus();
      if (window.gtag) gtag('event', 'generate_lead', { project: val('project'), intent: intent() });
    } catch (err) {
      status.className = 'form-status err'; status.textContent = (err && err.message ? err.message + ' ' : '') + 'You can also call 305-833-5025.';
    } finally { submit.disabled = uploading > 0; }
  });

  // Jumping in from a page for one service? Skip what we already know.
  go(val('project') && val('intent') ? 2 : val('project') ? 1 : 0, false);
});

// Show the license number only when the server has one configured.
SITE_CONFIG.then((c) => {
  if (c && c.license) document.querySelectorAll('[data-license]').forEach((el) => (el.textContent = 'Florida Certified General Contractor · ' + c.license));
}).catch(() => {});

// Ballpark estimator on the home page.
document.querySelectorAll('form[data-estimate]').forEach((form) => {
  const out = form.parentElement.querySelector('[data-est-result]');
  const sel = form.querySelector('select[name="project_type"]');
  const sizeLabel = form.querySelector('[data-size]');
  const syncUnit = () => {
    const unit = sel.selectedOptions[0].dataset.unit;
    sizeLabel.hidden = !unit;
    sizeLabel.querySelector('[data-unit]').textContent = unit ? '(' + unit + ')' : '';
  };
  sel.addEventListener('change', syncUnit); syncUnit();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    out.textContent = 'Working it out…';
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const r = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((x) => x.json());
      if (!r.ok) { out.innerHTML = '<p class="err-text"></p>'; out.firstChild.textContent = r.error; return; }
      out.innerHTML = '<div class="est-range"></div><p class="muted est-meta"></p><p class="small muted"></p><a class="btn dark" href="#quote">Get a real estimate</a>';
      out.querySelector('.est-range').textContent = r.range_text;
      out.querySelector('.est-meta').textContent = [r.label, r.size, r.finish + ' finish', r.county, 'about ' + r.typical_schedule_weeks[0] + ' to ' + r.typical_schedule_weeks[1] + ' weeks to build'].filter(Boolean).join(' · ');
      out.querySelector('.small').textContent = r.disclaimer;
      const q = document.querySelector('.quote-form'); const pr = q && q.querySelector('input[name="intent"][value="price"]'); if (pr && !q.querySelector('input[name="intent"]:checked')) pr.checked = true;
      const details = document.querySelector('.quote-form textarea[name="details"]');
      if (details && !details.value) details.value = 'Ballpark from website: ' + r.label + (r.size ? ', ' + r.size : '') + ', ' + r.finish + ' finish, ' + r.range_text + '.';
    } catch { out.textContent = 'Could not load an estimate. Call or text 305-833-5025.'; }
  });
});
