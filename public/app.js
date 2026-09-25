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
      status.textContent = 'Thanks — we got it. We reply within one business day.';
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
