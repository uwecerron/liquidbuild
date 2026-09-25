// Quote forms: submit with fetch, show inline status. Falls back to a normal POST without JS.
document.querySelectorAll('form[data-quote]').forEach((form) => {
  const page = form.querySelector('input[name="page"]');
  if (page) page.value = location.pathname;
  const status = form.querySelector('.form-status');
  const btn = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status';
    status.textContent = 'Sending…';
    btn.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || 'Something went wrong.');
      form.reset();
      if (page) page.value = location.pathname;
      status.className = 'form-status ok';
      status.textContent = 'Thanks, we got it. We reply within one business day.';
    } catch (err) {
      status.className = 'form-status err';
      status.textContent = (err && err.message ? err.message + ' ' : '') + 'You can also call 305-833-5025.';
    } finally {
      btn.disabled = false;
    }
  });
});

// Show the license number only when the server has one configured.
fetch('/api/config').then((r) => r.json()).then((c) => {
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
      const details = document.querySelector('.quote-form textarea[name="details"]');
      if (details && !details.value) details.value = 'Ballpark from website: ' + r.label + (r.size ? ', ' + r.size : '') + ', ' + r.finish + ' finish, ' + r.range_text + '.';
    } catch { out.textContent = 'Could not load an estimate. Call or text 305-833-5025.'; }
  });
});
