// CRM JSON API. Mounted at /api/crm/* (Vercel: api/crm.js; local: server.js).
const { db, migrate, STAGES, e164, addActivity } = require('./db');
const auth = require('./auth');
const { sendSms, sendEmail, smsReady, emailReady } = require('./notify');
const { clean } = require('./lead');

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const need = (cond, status, msg) => { if (!cond) throw new HttpError(status, msg); };
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

function send(res, status, obj, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(obj));
}

async function loadLead(id) {
  const [lead] = await db()`SELECT l.*, u.name AS assigned_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = ${id}`;
  need(lead, 404, 'Lead not found');
  return lead;
}

function bidText(lead, bid, user) {
  return [
    `Hi ${(lead.name || '').split(' ')[0] || 'there'},`, '',
    `Here is our estimate for your ${String(lead.project || 'project').toLowerCase()}${lead.location ? ' in ' + lead.location : ''}:`, '',
    `${bid.title}: ${money(bid.amount)}`, '',
    bid.scope ? 'Scope:\n' + bid.scope + '\n' : '',
    bid.valid_until ? `Valid until ${new Date(bid.valid_until).toLocaleDateString('en-US')}.` : 'Valid for 30 days.',
    '', 'Reply to this email or call/text 305-833-5025 with any questions.', '',
    `${user.name || 'The team'}`, 'Liquid Build',
  ].join('\n');
}

const routes = [];
const route = (method, pattern, fn, { open = false, admin = false } = {}) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, open, admin });

// ---------- auth ----------
route('POST', 'login', async ({ body, res }) => {
  const u = await auth.login(body.email, body.password);
  need(u, 401, 'Wrong email or password.');
  return send(res, 200, { ok: true, user: u }, { 'Set-Cookie': auth.sessionCookie(u) });
}, { open: true });

route('POST', 'logout', async ({ res }) => send(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookie() }), { open: true });

route('GET', 'me', async ({ user }) => ({ user, stages: STAGES, integrations: { sms: smsReady(), email: emailReady() } }));

route('POST', 'me/password', async ({ user, body }) => {
  const [u] = await db()`SELECT password_hash FROM users WHERE id = ${user.id}`;
  need(auth.checkPassword(body.current, u.password_hash), 400, 'Current password is wrong.');
  need(String(body.new || '').length >= 8, 400, 'New password must be at least 8 characters.');
  await db()`UPDATE users SET password_hash = ${auth.hashPassword(body.new)} WHERE id = ${user.id}`;
  return { ok: true };
});

// ---------- dashboard ----------
route('GET', 'stats', async () => {
  const s = db();
  const byStage = await s`SELECT stage, count(*)::int AS n, coalesce(sum(value),0)::float AS value FROM leads GROUP BY stage`;
  const [due] = await s`SELECT count(*)::int AS n FROM leads WHERE next_follow_up <= current_date AND stage NOT IN ('won','lost')`;
  const [unread] = await s`SELECT count(*)::int AS n FROM leads WHERE unread > 0`;
  const [week] = await s`SELECT count(*)::int AS n FROM leads WHERE created_at > now() - interval '7 days'`;
  return { byStage, followUpsDue: due.n, unread: unread.n, newThisWeek: week.n };
});

// ---------- leads ----------
route('GET', 'leads', async ({ query, user }) => {
  const s = db();
  const q = clean(query.q, 100);
  const like = '%' + q + '%';
  const rows = await s`
    SELECT l.id, l.name, l.email, l.phone, l.project, l.location, l.stage, l.source, l.value, l.next_follow_up, l.unread,
           l.created_at, l.last_activity_at, l.assigned_to, u.name AS assigned_name, l.sms_opt_out,
           (SELECT body FROM activities a WHERE a.lead_id = l.id ORDER BY a.created_at DESC LIMIT 1) AS last_activity
    FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
    WHERE (${q} = '' OR l.name ILIKE ${like} OR l.email ILIKE ${like} OR l.phone ILIKE ${like} OR l.project ILIKE ${like} OR l.location ILIKE ${like})
      AND (${query.mine !== '1'} OR l.assigned_to = ${user.id})
      AND (${!query.stage} OR l.stage = ${query.stage || ''})
    ORDER BY l.unread DESC, l.last_activity_at DESC LIMIT 500`;
  return { leads: rows };
});

route('POST', 'leads', async ({ body, user }) => {
  need(clean(body.name), 400, 'Name is required.');
  const [lead] = await db()`INSERT INTO leads (name, email, phone, project, location, details, source, stage, assigned_to, value, sms_consent)
    VALUES (${clean(body.name, 120)}, ${clean(body.email, 200).toLowerCase() || null}, ${e164(body.phone) || clean(body.phone, 40) || null}, ${clean(body.project, 80) || 'Other'},
            ${clean(body.location, 200) || null}, ${clean(body.details, 6000) || null}, ${clean(body.source, 40) || 'manual'}, ${STAGES.includes(body.stage) ? body.stage : 'new'},
            ${body.assigned_to ? Number(body.assigned_to) : user.id}, ${body.value ? Number(body.value) : null}, ${body.sms_consent === true})
    RETURNING *`;
  await addActivity(lead.id, 'system', `Lead added by ${user.name || user.email}`, {}, user.id);
  await db()`UPDATE leads SET unread = 0 WHERE id = ${lead.id}`;
  return { lead };
});

route('GET', 'leads/:id', async ({ params }) => {
  const s = db();
  const lead = await loadLead(params.id);
  const activities = await s`SELECT a.*, u.name AS user_name FROM activities a LEFT JOIN users u ON u.id = a.user_id WHERE a.lead_id = ${lead.id} ORDER BY a.created_at ASC`;
  const bids = await s`SELECT * FROM bids WHERE lead_id = ${lead.id} ORDER BY created_at DESC`;
  return { lead, activities, bids };
});

route('PATCH', 'leads/:id', async ({ params, body, user }) => {
  const s = db();
  const before = await loadLead(params.id);
  const fields = ['name', 'email', 'phone', 'project', 'location', 'details', 'stage', 'assigned_to', 'value', 'next_follow_up', 'sms_consent'];
  const upd = {};
  for (const f of fields) if (f in body) upd[f] = body[f] === '' ? null : body[f];
  if ('stage' in upd) need(STAGES.includes(upd.stage), 400, 'Unknown stage');
  if ('phone' in upd && upd.phone) upd.phone = e164(upd.phone) || clean(upd.phone, 40);
  if ('assigned_to' in upd) upd.assigned_to = upd.assigned_to ? Number(upd.assigned_to) : null;
  if ('value' in upd) upd.value = upd.value === null ? null : Number(String(upd.value).replace(/[^0-9.]/g, '')) || null;
  if (!Object.keys(upd).length) return { lead: before };
  await s`UPDATE leads SET ${s(upd)}, updated_at = now() WHERE id = ${before.id}`;
  if (upd.stage && upd.stage !== before.stage) await addActivity(before.id, 'stage', `Stage: ${before.stage} → ${upd.stage}`, {}, user.id);
  if ('assigned_to' in upd && upd.assigned_to !== before.assigned_to) {
    const [u] = upd.assigned_to ? await s`SELECT name, email FROM users WHERE id = ${upd.assigned_to}` : [null];
    await addActivity(before.id, 'system', u ? `Assigned to ${u.name || u.email}` : 'Unassigned', {}, user.id);
  }
  if ('next_follow_up' in upd && upd.next_follow_up !== before.next_follow_up) await addActivity(before.id, 'system', upd.next_follow_up ? `Follow-up set for ${upd.next_follow_up}` : 'Follow-up cleared', {}, user.id);
  await s`UPDATE leads SET unread = 0 WHERE id = ${before.id}`;
  return { lead: await loadLead(before.id) };
});

route('DELETE', 'leads/:id', async ({ params }) => { await db()`DELETE FROM leads WHERE id = ${params.id}`; return { ok: true }; }, { admin: true });

route('POST', 'leads/:id/read', async ({ params }) => { await db()`UPDATE leads SET unread = 0 WHERE id = ${params.id}`; return { ok: true }; });

route('POST', 'leads/:id/notes', async ({ params, body, user }) => {
  const lead = await loadLead(params.id);
  need(clean(body.body), 400, 'Note is empty.');
  const a = await addActivity(lead.id, 'note', clean(body.body, 8000), {}, user.id);
  await db()`UPDATE leads SET unread = 0 WHERE id = ${lead.id}`;
  return { activity: a };
});

route('POST', 'leads/:id/sms', async ({ params, body, user }) => {
  const lead = await loadLead(params.id);
  const to = e164(lead.phone);
  need(to, 400, 'This lead has no valid US phone number.');
  need(!lead.sms_opt_out, 400, 'This person replied STOP. They can text START to opt back in.');
  const text = clean(body.body, 1500);
  need(text, 400, 'Message is empty.');
  const r = await sendSms(to, text);
  const a = await addActivity(lead.id, 'sms_out', text, { sid: r.sid, to }, user.id);
  await db()`UPDATE leads SET unread = 0, stage = CASE WHEN stage = 'new' THEN 'contacted' ELSE stage END WHERE id = ${lead.id}`;
  return { activity: a };
});

route('POST', 'leads/:id/email', async ({ params, body, user }) => {
  const lead = await loadLead(params.id);
  need(lead.email, 400, 'This lead has no email address.');
  const subject = clean(body.subject, 200) || `Your ${String(lead.project || 'project').toLowerCase()} | Liquid Build`;
  const text = clean(body.body, 20000);
  need(text, 400, 'Email is empty.');
  const r = await sendEmail({ to: lead.email, subject, text, replyTo: user.email });
  const a = await addActivity(lead.id, 'email_out', text, { subject, id: r.id, to: lead.email }, user.id);
  await db()`UPDATE leads SET unread = 0, stage = CASE WHEN stage = 'new' THEN 'contacted' ELSE stage END WHERE id = ${lead.id}`;
  return { activity: a };
});

// ---------- bids ----------
route('POST', 'leads/:id/bids', async ({ params, body, user }) => {
  const lead = await loadLead(params.id);
  const amount = Number(String(body.amount || '').replace(/[^0-9.]/g, ''));
  need(amount > 0, 400, 'Bid amount is required.');
  const [bid] = await db()`INSERT INTO bids (lead_id, title, amount, scope, valid_until, created_by)
    VALUES (${lead.id}, ${clean(body.title, 160) || 'Estimate'}, ${amount}, ${clean(body.scope, 10000)}, ${body.valid_until || null}, ${user.id}) RETURNING *`;
  await db()`UPDATE leads SET value = coalesce(value, ${amount}) WHERE id = ${lead.id}`;
  await addActivity(lead.id, 'bid', `Bid created: ${bid.title}, ${money(amount)}`, { bid_id: bid.id }, user.id);
  return { bid };
});

route('PATCH', 'bids/:id', async ({ params, body, user }) => {
  const s = db();
  const [bid] = await s`SELECT * FROM bids WHERE id = ${params.id}`;
  need(bid, 404, 'Bid not found');
  const upd = {};
  for (const f of ['title', 'scope', 'status', 'valid_until']) if (f in body) upd[f] = body[f] === '' ? null : body[f];
  if ('amount' in body) upd.amount = Number(String(body.amount).replace(/[^0-9.]/g, '')) || 0;
  if (upd.status) need(['draft', 'sent', 'accepted', 'declined'].includes(upd.status), 400, 'Unknown bid status');
  await s`UPDATE bids SET ${s(upd)}, updated_at = now() WHERE id = ${bid.id}`;
  if (upd.status && upd.status !== bid.status) {
    await addActivity(bid.lead_id, 'bid', `Bid "${bid.title}" marked ${upd.status}`, { bid_id: bid.id }, user.id);
    if (upd.status === 'accepted') await s`UPDATE leads SET stage = 'won', value = ${upd.amount || bid.amount} WHERE id = ${bid.lead_id}`;
  }
  const [out] = await s`SELECT * FROM bids WHERE id = ${bid.id}`;
  return { bid: out };
});

route('POST', 'bids/:id/send', async ({ params, body, user }) => {
  const s = db();
  const [bid] = await s`SELECT * FROM bids WHERE id = ${params.id}`;
  need(bid, 404, 'Bid not found');
  const lead = await loadLead(bid.lead_id);
  const via = body.via === 'sms' ? 'sms' : 'email';
  const text = bidText(lead, bid, user);
  if (via === 'email') {
    need(lead.email, 400, 'This lead has no email address.');
    await sendEmail({ to: lead.email, subject: `Estimate: ${bid.title} | Liquid Build`, text, replyTo: user.email });
    await addActivity(lead.id, 'email_out', text, { subject: `Estimate: ${bid.title}`, bid_id: bid.id }, user.id);
  } else {
    const to = e164(lead.phone);
    need(to && !lead.sms_opt_out, 400, 'Cannot text this lead.');
    const short = `Liquid Build estimate for your ${String(lead.project || 'project').toLowerCase()}: ${bid.title}, ${money(bid.amount)}.${bid.valid_until ? ' Valid until ' + new Date(bid.valid_until).toLocaleDateString('en-US') + '.' : ''} Reply with questions or call 305-833-5025.`;
    await sendSms(to, short);
    await addActivity(lead.id, 'sms_out', short, { bid_id: bid.id }, user.id);
  }
  await s`UPDATE bids SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = ${bid.id}`;
  await s`UPDATE leads SET stage = CASE WHEN stage IN ('won','lost') THEN stage ELSE 'bid_sent' END, unread = 0 WHERE id = ${lead.id}`;
  return { ok: true };
});

// ---------- team ----------
route('GET', 'users', async () => ({ users: await db()`SELECT id, email, name, phone, role, active, created_at FROM users ORDER BY name` }));

route('POST', 'users', async ({ body }) => {
  const email = clean(body.email, 200).toLowerCase();
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Valid email required.');
  need(String(body.password || '').length >= 8, 400, 'Temporary password must be at least 8 characters.');
  const role = body.role === 'admin' ? 'admin' : 'member';
  const [u] = await db()`INSERT INTO users (email, name, phone, role, password_hash) VALUES (${email}, ${clean(body.name, 120)}, ${clean(body.phone, 40) || null}, ${role}, ${auth.hashPassword(body.password)})
    ON CONFLICT (email) DO NOTHING RETURNING id, email, name, role, active`;
  need(u, 409, 'That email already has an account.');
  return { user: u };
}, { admin: true });

route('PATCH', 'users/:id', async ({ params, body, user }) => {
  const s = db();
  const upd = {};
  if ('name' in body) upd.name = clean(body.name, 120);
  if ('phone' in body) upd.phone = clean(body.phone, 40) || null;
  if ('role' in body) upd.role = body.role === 'admin' ? 'admin' : 'member';
  if ('active' in body) upd.active = Boolean(body.active);
  if (body.password) { need(String(body.password).length >= 8, 400, 'Password must be at least 8 characters.'); upd.password_hash = auth.hashPassword(body.password); }
  need(!(Number(params.id) === user.id && (upd.active === false || upd.role === 'member')), 400, "You can't remove your own admin access.");
  if (Object.keys(upd).length) await s`UPDATE users SET ${s(upd)} WHERE id = ${params.id}`;
  const [u] = await s`SELECT id, email, name, phone, role, active FROM users WHERE id = ${params.id}`;
  return { user: u };
}, { admin: true });

// ---------- dispatcher ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const path = (url.searchParams.get('path') || url.pathname.replace(/^\/api\/crm\/?/, '')).replace(/^\/+|\/+$/g, '');
  const query = Object.fromEntries(url.searchParams.entries());
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  try {
    const r = routes.find((x) => x.method === req.method && x.re.test(path));
    need(r, 404, 'Not found');
    // CSRF: state-changing requests must come from our own pages (JSON + same origin).
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      need(!origin || new URL(origin).host === req.headers.host, 403, 'Bad origin');
      need(String(req.headers['content-type'] || '').includes('application/json'), 415, 'JSON required');
    }
    await migrate();
    await auth.ensureAdmin();
    let user = null;
    if (!r.open) {
      user = await auth.currentUser(req);
      need(user, 401, 'Please log in.');
      need(!r.admin || user.role === 'admin', 403, 'Admins only.');
    }
    const params = r.re.exec(path).groups || {};
    const out = await r.fn({ req, res, body, query, params, user });
    if (out !== undefined && !res.writableEnded) send(res, 200, out);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('[crm]', req.method, path, e);
    if (!res.writableEnded) send(res, status, { ok: false, error: status >= 500 && !e.status ? 'Server error' : e.message });
  }
}

module.exports = { handle, STAGES };
