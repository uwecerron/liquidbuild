// Liquid Build CRM front end. Plain JavaScript, no build step.
(() => {
  const STAGE_LABEL = { new: 'New', contacted: 'Contacted', site_visit: 'Site visit', bid_sent: 'Bid sent', won: 'Won', lost: 'Lost' };
  const SOURCE_LABEL = { website: 'Website', 'ai-agent': 'AI agent', sms: 'Text', manual: 'Added by team' };
  const state = { me: null, stages: Object.keys(STAGE_LABEL), integrations: {}, leads: [], users: [], view: 'board', openId: null, composer: 'note' };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n || n === 0) && n !== null ? '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '';
  const ago = (d) => {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const when = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const today = () => new Date().toISOString().slice(0, 10);
  const dateOnly = (d) => (d ? String(d).slice(0, 10) : '');

  function toast(msg, isErr) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(t._h); t._h = setTimeout(() => (t.className = 'toast'), 3200);
  }

  async function api(method, path, body) {
    const r = await fetch('/api/crm/' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    const out = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== 'login') { showLogin(); throw new Error(out.error || 'Please log in.'); }
    if (!r.ok) throw new Error(out.error || 'Something went wrong.');
    return out;
  }

  // ---------- auth ----------
  function showLogin() { $('#app').hidden = true; $('#drawer').hidden = true; $('#scrim').hidden = true; $('#login').hidden = false; }
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#login-err').textContent = '';
    const f = new FormData(e.target);
    try { await api('POST', 'login', { email: f.get('email'), password: f.get('password') }); await boot(); }
    catch (err) { $('#login-err').textContent = err.message; }
  });
  $('#logout-btn').onclick = async () => { await api('POST', 'logout', {}).catch(() => {}); location.reload(); };
  $('#me-btn').onclick = () => { const m = $('#me-menu'); m.hidden = !m.hidden; $('#me-btn').setAttribute('aria-expanded', String(!m.hidden)); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.me')) $('#me-menu').hidden = true; });
  $('#pw-btn').onclick = () => modal('Change password', `
    <label>Current password<input name="current" type="password" required autocomplete="current-password"></label>
    <label>New password (8+ characters)<input name="new" type="password" required minlength="8" autocomplete="new-password"></label>`, 'Save', async (f) => {
    await api('POST', 'me/password', { current: f.get('current'), new: f.get('new') }); toast('Password changed.');
  });

  async function boot() {
    try {
      const me = await api('GET', 'me');
      Object.assign(state, { me: me.user, stages: me.stages, integrations: me.integrations });
    } catch { return showLogin(); }
    $('#login').hidden = true; $('#app').hidden = false;
    $('#me-btn').textContent = (state.me.name || state.me.email).slice(0, 1).toUpperCase();
    $('#me-name').textContent = `${state.me.name || ''} ${state.me.email} · ${state.me.role}`;
    state.users = (await api('GET', 'users')).users;
    await refresh();
    const m = location.hash.match(/lead-(\d+)/); if (m) openLead(Number(m[1]));
    clearInterval(state.poll); state.poll = setInterval(() => refresh(true), 20000);
  }

  // ---------- data ----------
  async function refresh(silent) {
    const q = encodeURIComponent($('#search').value.trim());
    const [{ leads }, stats] = await Promise.all([api('GET', `leads?q=${q}&mine=${$('#mine').checked ? 1 : 0}`), api('GET', 'stats')]);
    const newUnread = leads.filter((l) => l.unread).length > state.leads.filter((l) => l.unread).length;
    state.leads = leads;
    renderStatus(stats); render();
    if (silent && newUnread) toast('New activity in your pipeline.');
    if (silent && state.openId && !$('#drawer').hidden && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') openLead(state.openId, true);
  }
  let searchT; $('#search').addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(refresh, 250); });
  $('#mine').addEventListener('change', () => refresh());

  function renderStatus(stats) {
    const open = stats.byStage.filter((s) => !['won', 'lost'].includes(s.stage));
    const pipe = open.reduce((a, s) => a + s.value, 0);
    const won = stats.byStage.find((s) => s.stage === 'won');
    const chips = [
      `<span class="chip">${stats.newThisWeek} new this week</span>`,
      `<span class="chip">Open pipeline ${money(pipe) || '$0'}</span>`,
      won ? `<span class="chip ok">Won ${money(won.value) || '$0'}</span>` : '',
      stats.followUpsDue ? `<span class="chip warn">${stats.followUpsDue} follow-up${stats.followUpsDue > 1 ? 's' : ''} due</span>` : '',
      stats.unread ? `<span class="chip warn">${stats.unread} unread</span>` : '',
      !state.integrations.sms ? '<span class="chip warn">Texting off: add Twilio keys</span>' : '<span class="chip ok">Texting on</span>',
      !state.integrations.email ? '<span class="chip warn">Email off: add Resend key</span>' : '<span class="chip ok">Email on</span>',
    ];
    $('#statusbar').innerHTML = chips.join('');
  }

  // ---------- views ----------
  $$('.tabs button').forEach((b) => (b.onclick = () => {
    state.view = b.dataset.view; $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    ['board', 'list', 'team'].forEach((v) => ($('#view-' + v).hidden = v !== state.view)); render();
  }));

  function card(l) {
    const due = l.next_follow_up && dateOnly(l.next_follow_up) <= today() && !['won', 'lost'].includes(l.stage);
    return `<article class="card" draggable="true" data-id="${l.id}" tabindex="0" aria-label="${esc(l.name)}">
      <div class="name"><span>${esc(l.name)}</span>${l.unread ? `<span class="badge">${l.unread}</span>` : ''}</div>
      <div class="meta">${esc(l.project || '')}${l.location ? ' · ' + esc(l.location) : ''}</div>
      ${l.value ? `<div class="meta"><b>${money(l.value)}</b></div>` : ''}
      ${l.last_activity ? `<div class="last">${esc(l.last_activity)}</div>` : ''}
      <div class="meta" style="display:flex;justify-content:space-between;gap:6px"><span class="src">${esc(SOURCE_LABEL[l.source] || l.source)}</span><span>${due ? '<span class="due">Follow up</span> ' : ''}${ago(l.last_activity_at)}${l.assigned_name ? ' · ' + esc(l.assigned_name.split(' ')[0]) : ''}</span></div>
    </article>`;
  }

  function render() {
    if (state.view === 'board') {
      $('#view-board').innerHTML = state.stages.map((s) => {
        const items = state.leads.filter((l) => l.stage === s);
        const total = items.reduce((a, l) => a + Number(l.value || 0), 0);
        return `<div class="col" data-stage="${s}"><div class="col-head">${STAGE_LABEL[s]} <span>${items.length}${total ? ' · ' + money(total) : ''}</span></div>${items.map(card).join('') || '<div class="empty">Nothing here yet.</div>'}</div>`;
      }).join('');
      $$('.card').forEach((c) => {
        c.onclick = () => openLead(Number(c.dataset.id));
        c.onkeydown = (e) => { if (e.key === 'Enter') openLead(Number(c.dataset.id)); };
        c.ondragstart = (e) => { e.dataTransfer.setData('text/plain', c.dataset.id); };
      });
      $$('.col').forEach((col) => {
        col.ondragover = (e) => { e.preventDefault(); col.classList.add('drop'); };
        col.ondragleave = () => col.classList.remove('drop');
        col.ondrop = async (e) => {
          e.preventDefault(); col.classList.remove('drop');
          const id = Number(e.dataTransfer.getData('text/plain'));
          const lead = state.leads.find((l) => l.id === id);
          if (!lead || lead.stage === col.dataset.stage) return;
          lead.stage = col.dataset.stage; render();
          try { await api('PATCH', 'leads/' + id, { stage: col.dataset.stage }); toast(`Moved to ${STAGE_LABEL[col.dataset.stage]}.`); } catch (err) { toast(err.message, true); }
          refresh(true);
        };
      });
    } else if (state.view === 'list') {
      $('#view-list').innerHTML = `<table><thead><tr><th>Name</th><th>Project</th><th>Stage</th><th>Value</th><th>Owner</th><th>Follow-up</th><th>Last activity</th></tr></thead><tbody>${
        state.leads.map((l) => `<tr data-id="${l.id}"><td><b>${esc(l.name)}</b> ${l.unread ? `<span class="badge">${l.unread}</span>` : ''}<br><span style="color:var(--stone);font-size:13px">${esc(l.phone || '')} ${esc(l.email || '')}</span></td>
          <td>${esc(l.project || '')}<br><span style="color:var(--stone);font-size:13px">${esc(l.location || '')}</span></td><td>${STAGE_LABEL[l.stage]}</td><td>${money(l.value)}</td>
          <td>${esc(l.assigned_name || '')}</td><td>${dateOnly(l.next_follow_up)}</td><td>${ago(l.last_activity_at)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No leads yet.</td></tr>'
      }</tbody></table>`;
      $$('#view-list tbody tr[data-id]').forEach((r) => (r.onclick = () => openLead(Number(r.dataset.id))));
    } else {
      renderTeam();
    }
  }

  async function renderTeam() {
    state.users = (await api('GET', 'users')).users;
    const admin = state.me.role === 'admin';
    $('#view-team').innerHTML = `<h2>Team</h2>
      <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
      ${state.users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role}</td><td>${u.active ? 'Active' : 'Disabled'}</td>
        ${admin ? `<td class="actions">${u.id !== state.me.id ? `<button class="btn small" data-act="role" data-id="${u.id}">${u.role === 'admin' ? 'Make member' : 'Make admin'}</button><button class="btn small" data-act="active" data-id="${u.id}">${u.active ? 'Disable' : 'Enable'}</button>` : ''}<button class="btn small" data-act="pw" data-id="${u.id}">Reset password</button></td>` : ''}</tr>`).join('')}
      </tbody></table>
      ${admin ? `<form class="team-form" id="add-user">
        <label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label>
        <label>Temporary password<input name="password" minlength="8" required></label>
        <label>Role<select name="role"><option value="member">Member</option><option value="admin">Admin</option></select></label>
        <button class="btn primary">Add teammate</button></form>
        <p style="color:var(--stone);font-size:13px">Share the temporary password with your teammate. They can change it from the menu after logging in.</p>` : ''}`;
    if (!admin) return;
    $('#add-user').onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      try { await api('POST', 'users', Object.fromEntries(f)); toast('Teammate added.'); renderTeam(); } catch (err) { toast(err.message, true); }
    };
    $$('#view-team [data-act]').forEach((b) => (b.onclick = async () => {
      const u = state.users.find((x) => x.id === Number(b.dataset.id));
      try {
        if (b.dataset.act === 'role') await api('PATCH', 'users/' + u.id, { role: u.role === 'admin' ? 'member' : 'admin' });
        if (b.dataset.act === 'active') await api('PATCH', 'users/' + u.id, { active: !u.active });
        if (b.dataset.act === 'pw') return modal('Reset password for ' + (u.name || u.email), '<label>New temporary password (8+ characters)<input name="password" minlength="8" required></label>', 'Save', async (f) => { await api('PATCH', 'users/' + u.id, { password: f.get('password') }); toast('Password reset.'); });
        renderTeam();
      } catch (err) { toast(err.message, true); }
    }));
  }

  // ---------- lead drawer ----------
  function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; state.openId = null; history.replaceState(null, '', location.pathname); refresh(true); }
  $('#scrim').onclick = closeDrawer;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden && !$('#modal').open) closeDrawer(); });

  async function openLead(id, keepScroll) {
    let data;
    try { data = await api('GET', 'leads/' + id); } catch (err) { return toast(err.message, true); }
    state.openId = id; history.replaceState(null, '', '#lead-' + id);
    const { lead, activities, bids } = data;
    const d = $('#drawer'); const scroll = d.scrollTop;
    const userOpts = `<option value="">Unassigned</option>` + state.users.filter((u) => u.active).map((u) => `<option value="${u.id}" ${u.id === lead.assigned_to ? 'selected' : ''}>${esc(u.name || u.email)}</option>`).join('');
    const canText = state.integrations.sms && lead.phone && !lead.sms_opt_out;
    const canEmail = state.integrations.email && lead.email;
    $('#drawer-body').innerHTML = `
      <div class="d-head"><div><div class="src">${esc(SOURCE_LABEL[lead.source] || lead.source)} · ${when(lead.created_at)}</div><h2>${esc(lead.name)}</h2>
        <div style="color:var(--stone)">${esc(lead.project || '')}${lead.location ? ' · ' + esc(lead.location) : ''}</div></div>
        <button class="close" aria-label="Close" id="close-drawer">×</button></div>
      <div class="contact">
        ${lead.phone ? `<a class="btn" href="tel:${esc(lead.phone)}">Call ${esc(lead.phone)}</a>` : ''}
        ${lead.email ? `<a class="btn" href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : ''}
        <button class="btn" id="edit-lead">Edit contact</button>
        ${state.me.role === 'admin' ? '<button class="btn" id="del-lead" style="color:var(--warn)">Delete</button>' : ''}
      </div>
      <div class="panel">
        <div class="grid2">
          <label>Stage<select id="f-stage">${state.stages.map((s) => `<option value="${s}" ${s === lead.stage ? 'selected' : ''}>${STAGE_LABEL[s]}</option>`).join('')}</select></label>
          <label>Owner<select id="f-owner">${userOpts}</select></label>
          <label>Deal value<input id="f-value" inputmode="decimal" value="${lead.value ? Number(lead.value) : ''}" placeholder="$"></label>
          <label>Next follow-up<input id="f-follow" type="date" value="${dateOnly(lead.next_follow_up)}"></label>
        </div>
        <div class="chip-row">${[lead.intent && ({ price: 'Wants a price', plans: 'Sent plans or photos', design: 'Wants design help' }[lead.intent] || lead.intent), lead.budget, lead.timeline, lead.contact_pref && 'Prefers ' + lead.contact_pref].filter(Boolean).map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')}</div>
        ${lead.details ? `<div><h3 style="margin-bottom:6px">Request</h3><p class="details">${esc(lead.details)}</p></div>` : ''}
        ${filesHtml(lead.files)}
        ${lead.sms_opt_out ? '<div class="chip warn" style="align-self:flex-start">Opted out of texts</div>' : lead.sms_consent ? '<div class="chip ok" style="align-self:flex-start">OK to text</div>' : ''}
      </div>

      <div class="panel">
        <h3>Conversation</h3>
        <div class="timeline">${activities.map(actHtml).join('') || '<div class="empty">No activity yet.</div>'}</div>
        <div class="composer">
          <div class="composer-tabs">
            <button data-c="note" class="${state.composer === 'note' ? 'on' : ''}">Note</button>
            <button data-c="sms" class="${state.composer === 'sms' ? 'on' : ''}" ${canText ? '' : 'disabled title="Needs a phone number, texting set up, and no STOP"'}>Text</button>
            <button data-c="email" class="${state.composer === 'email' ? 'on' : ''}" ${canEmail ? '' : 'disabled title="Needs an email address and email set up"'}>Email</button>
          </div>
          <input id="c-subject" placeholder="Subject" ${state.composer === 'email' ? '' : 'hidden'} value="Your ${esc(lead.project || 'project')}: Liquid Build">
          <textarea id="c-body" rows="3" placeholder="${state.composer === 'note' ? 'Add an internal note…' : state.composer === 'sms' ? 'Write a text…' : 'Write an email…'}"></textarea>
          <div class="row"><span id="c-count"></span><button class="btn primary" id="c-send">${state.composer === 'note' ? 'Save note' : 'Send'}</button></div>
        </div>
      </div>

      <div class="panel">
        <h3>Bids</h3>
        ${bids.map((b) => `<div class="bid" data-bid="${b.id}">
          <div class="bid-top"><div><b>${esc(b.title)}</b> <span class="pill ${b.status}">${b.status}</span></div><div class="bid-amt">${money(b.amount)}</div></div>
          ${b.scope ? `<p class="details">${esc(b.scope)}</p>` : ''}
          <div style="font-size:12px;color:var(--stone)">${b.valid_until ? 'Valid until ' + dateOnly(b.valid_until) + ' · ' : ''}${b.sent_at ? 'Sent ' + when(b.sent_at) : 'Not sent'}</div>
          <div class="actions">
            ${canEmail ? `<button class="btn small" data-b="send-email">Email to client</button>` : ''}
            ${canText ? `<button class="btn small" data-b="send-sms">Text to client</button>` : ''}
            <button class="btn small" data-b="accepted">Mark accepted</button>
            <button class="btn small" data-b="declined">Mark declined</button>
          </div></div>`).join('') || '<div class="empty">No bids yet.</div>'}
        <button class="btn" id="new-bid" style="align-self:flex-start">New bid</button>
      </div>`;
    d.hidden = false; $('#scrim').hidden = false;
    if (keepScroll) d.scrollTop = scroll; else { d.scrollTop = 0; }
    const tl = $('.timeline'); if (!keepScroll) tl.lastElementChild && tl.lastElementChild.scrollIntoView({ block: 'nearest' });

    $('#close-drawer').onclick = closeDrawer;
    const patch = async (body, msg) => { try { await api('PATCH', 'leads/' + id, body); if (msg) toast(msg); openLead(id, true); refresh(true); } catch (err) { toast(err.message, true); } };
    $('#f-stage').onchange = (e) => patch({ stage: e.target.value }, 'Stage updated.');
    $('#f-owner').onchange = (e) => patch({ assigned_to: e.target.value }, 'Owner updated.');
    $('#f-value').onchange = (e) => patch({ value: e.target.value }, 'Value saved.');
    $('#f-follow').onchange = (e) => patch({ next_follow_up: e.target.value }, 'Follow-up saved.');
    $$('.composer-tabs button').forEach((b) => (b.onclick = () => { state.composer = b.dataset.c; openLead(id, true); }));
    const body = $('#c-body');
    body.oninput = () => { $('#c-count').textContent = state.composer === 'sms' ? `${body.value.length} characters${body.value.length > 160 ? ' (sends as ' + Math.ceil(body.value.length / 153) + ' texts)' : ''}` : ''; };
    $('#c-send').onclick = async () => {
      const text = body.value.trim(); if (!text) return;
      $('#c-send').disabled = true;
      try {
        if (state.composer === 'note') await api('POST', `leads/${id}/notes`, { body: text });
        if (state.composer === 'sms') await api('POST', `leads/${id}/sms`, { body: text });
        if (state.composer === 'email') await api('POST', `leads/${id}/email`, { subject: $('#c-subject').value, body: text });
        toast(state.composer === 'note' ? 'Note saved.' : 'Sent.'); openLead(id, true); refresh(true);
      } catch (err) { toast(err.message, true); $('#c-send').disabled = false; }
    };
    $('#edit-lead').onclick = () => modal('Edit contact', leadFields(lead), 'Save', async (f) => {
      await api('PATCH', 'leads/' + id, Object.fromEntries(f)); toast('Saved.'); openLead(id, true); refresh(true);
    });
    const del = $('#del-lead'); if (del) del.onclick = () => modal('Delete this lead?', `<p>This removes ${esc(lead.name)} and all notes, texts and bids. It can't be undone.</p>`, 'Delete', async () => {
      await api('DELETE', 'leads/' + id); toast('Deleted.'); closeDrawer();
    });
    $('#new-bid').onclick = () => modal('New bid', `
      <label>Title<input name="title" value="${esc(lead.project || 'Estimate')}" required></label>
      <label>Amount (USD)<input name="amount" inputmode="decimal" required placeholder="250000"></label>
      <label>Scope<textarea name="scope" rows="5" placeholder="What's included, allowances, exclusions"></textarea></label>
      <label>Valid until<input name="valid_until" type="date"></label>`, 'Create bid', async (f) => {
      await api('POST', `leads/${id}/bids`, Object.fromEntries(f)); toast('Bid created.'); openLead(id, true); refresh(true);
    });
    $$('.bid [data-b]').forEach((b) => (b.onclick = async () => {
      const bid = b.closest('.bid').dataset.bid; const act = b.dataset.b;
      try {
        if (act.startsWith('send-')) { await api('POST', `bids/${bid}/send`, { via: act === 'send-sms' ? 'sms' : 'email' }); toast('Bid sent.'); }
        else { await api('PATCH', `bids/${bid}`, { status: act }); toast('Bid marked ' + act + '.'); }
        openLead(id, true); refresh(true);
      } catch (err) { toast(err.message, true); }
    }));
    if (lead.unread) api('POST', `leads/${id}/read`, {}).then(() => refresh(true)).catch(() => {});
  }

  function filesHtml(files) {
  if (!Array.isArray(files) || !files.length) return '';
  const link = (f) => (f.stored === false ? f.url : '/api/file?u=' + encodeURIComponent(f.url));
  const isImg = (f) => /^image\/(jpeg|png|webp|gif)/.test(f.type || '') || /\.(jpe?g|png|webp|gif)$/i.test(f.name || '');
  return `<div><h3 style="margin-bottom:6px">Files (${files.length})</h3><div class="lead-files">${files.map((f) => isImg(f)
    ? `<a href="${esc(link(f))}" target="_blank" rel="noopener"><img src="${esc(link(f))}" alt="${esc(f.name)}" loading="lazy"></a>`
    : `<a class="doc" href="${esc(link(f))}" target="_blank" rel="noopener"><b>${esc((f.name.split('.').pop() || 'file').toUpperCase())}</b>${esc(f.name)}</a>`).join('')}</div></div>`;
}

function actHtml(a) {
    const who = a.user_name ? esc(a.user_name.split(' ')[0]) + ' · ' : '';
    const media = (a.meta && a.meta.media || []).map((u) => `<br><a href="${esc(u)}" target="_blank" rel="noopener">Photo</a>`).join('');
    switch (a.type) {
      case 'sms_in': return `<div class="act in"><div class="bubble">${esc(a.body)}${media}</div><div class="when">Text · ${when(a.created_at)}</div></div>`;
      case 'sms_out': return `<div class="act out"><div class="bubble">${esc(a.body)}</div><div class="when">${who}Text${a.meta && a.meta.auto ? ' (auto)' : ''} · ${when(a.created_at)}</div></div>`;
      case 'email_out': return `<div class="act out email"><div class="bubble"><b>${esc(a.meta && a.meta.subject || 'Email')}</b>\n${esc(a.body)}</div><div class="when">${who}Email · ${when(a.created_at)}</div></div>`;
      case 'note': return `<div class="act note"><div class="bubble">${esc(a.body)}</div><div class="when">${who}Note · ${when(a.created_at)}</div></div>`;
      default: return `<div class="act sys"><div class="bubble">${esc(a.body)} · ${who}${when(a.created_at)}</div></div>`;
    }
  }

  function leadFields(l = {}) {
    return `<label>Name<input name="name" required value="${esc(l.name || '')}"></label>
      <div class="grid2"><label>Phone<input name="phone" type="tel" value="${esc(l.phone || '')}"></label><label>Email<input name="email" type="email" value="${esc(l.email || '')}"></label></div>
      <div class="grid2"><label>Project<input name="project" value="${esc(l.project || '')}"></label><label>Location<input name="location" value="${esc(l.location || '')}"></label></div>
      <label>Details<textarea name="details" rows="4">${esc(l.details || '')}</textarea></label>`;
  }

  $('#new-lead-btn').onclick = () => modal('New lead', leadFields() + `<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="sms_consent" style="width:auto"> They agreed to receive texts</label>`, 'Add lead', async (f) => {
    const body = Object.fromEntries(f); body.sms_consent = f.get('sms_consent') === 'on';
    const { lead } = await api('POST', 'leads', body); toast('Lead added.'); await refresh(true); openLead(lead.id);
  });

  // ---------- modal ----------
  function modal(title, inner, okLabel, onOk) {
    const dlg = $('#modal'); const form = $('#modal-form');
    form.innerHTML = `<h3>${esc(title)}</h3>${inner}<p class="err" id="modal-err"></p><div class="dlg-actions"><button class="btn" value="cancel" formnovalidate>Cancel</button><button class="btn primary" value="ok">${esc(okLabel)}</button></div>`;
    form.onsubmit = async (e) => {
      if (e.submitter && e.submitter.value === 'cancel') return;
      e.preventDefault();
      try { await onOk(new FormData(form)); dlg.close(); } catch (err) { $('#modal-err').textContent = err.message; }
    };
    dlg.showModal();
  }

  boot();
})();
