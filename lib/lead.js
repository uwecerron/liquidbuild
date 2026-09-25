// New-lead intake shared by the website form (api/quote.js), the MCP server (api/mcp.js) and inbound texts.
// Saves to the CRM when DATABASE_URL is set, alerts the owner, and auto-texts the lead when they consented.
const { hasDb, db, migrate, e164, addActivity } = require('./db');
const { alertOwner, sendSms, smsReady } = require('./notify');
const uploads = require('./uploads');

const INTENTS = { price: 'Knows the scope, wants a price', plans: 'Has plans or photos', design: 'Has an idea, wants help designing it' };
const CONTACT = { text: 'Text', call: 'Call', email: 'Email' };

const recent = new Map(); // best-effort rate limit per warm instance

function clean(v, max = 2000) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function autoTextBody(lead) {
  const first = (lead.name || '').split(/\s+/)[0] || 'there';
  return process.env.AUTO_TEXT_TEMPLATE
    ? process.env.AUTO_TEXT_TEMPLATE.replace(/\{name\}/g, first).replace(/\{project\}/g, lead.project || 'project')
    : `Hi ${first}, this is Liquid Build. Thanks for reaching out about your ${String(lead.project || 'project').toLowerCase()}. We'll get back to you within one business day. You can reply to this number anytime. Reply STOP to opt out.`;
}

async function createLead(input, { source = 'website', ip = '' } = {}) {
  const files = uploads.cleanFiles(input.files, { anyHttps: source !== 'website' });
  const lead = {
    name: clean(input.name, 120), phone: clean(input.phone, 40), email: clean(input.email, 200).toLowerCase(),
    project: clean(input.project, 80) || 'Other', location: clean(input.location, 200),
    intent: INTENTS[clean(input.intent, 20)] ? clean(input.intent, 20) : '', budget: clean(input.budget, 60), timeline: clean(input.timeline, 60),
    contact_pref: CONTACT[clean(input.contact_pref, 10)] ? clean(input.contact_pref, 10) : '', files,
    page: clean(input.page, 300), source,
    sms_consent: ['yes', 'on', 'true', true].includes(input.sms_consent),
  };
  // One readable summary for email alerts and the CRM.
  lead.details = [
    lead.intent && 'Starting point: ' + INTENTS[lead.intent],
    lead.budget && 'Budget: ' + lead.budget,
    lead.timeline && 'Timeline: ' + lead.timeline,
    lead.contact_pref && 'Best way to reach: ' + CONTACT[lead.contact_pref],
    clean(input.size, 20) && 'Size: ' + clean(input.size, 20),
    clean(input.idea, 3000) && '\nIdea:\n' + clean(input.idea, 3000),
    clean(input.details, 6000) && '\nNotes:\n' + clean(input.details, 6000),
    clean(input.plan, 3000) && '\nQuick plan shown to them:\n' + clean(input.plan, 3000),
    files.length && '\nFiles:\n' + files.map((f) => '- ' + f.name + (f.stored ? '' : ' ' + f.url)).join('\n'),
  ].filter(Boolean).join('\n').slice(0, 10000);
  const phone = e164(lead.phone);
  let saved = null; const log = [];

  if (hasDb()) {
    try {
      await migrate();
      [saved] = await db()`INSERT INTO leads (name, email, phone, project, location, details, source, page, sms_consent, intent, budget, timeline, contact_pref, files)
        VALUES (${lead.name}, ${lead.email || null}, ${phone || lead.phone || null}, ${lead.project}, ${lead.location || null}, ${lead.details || null}, ${source}, ${lead.page || null}, ${lead.sms_consent},
          ${lead.intent || null}, ${lead.budget || null}, ${lead.timeline || null}, ${lead.contact_pref || null}, ${db().json(files)})
        RETURNING *`;
      await addActivity(saved.id, 'lead_created', `New ${source} lead: ${lead.project}${lead.location ? ' in ' + lead.location : ''}`, { ip, page: lead.page, details: lead.details });
    } catch (e) { console.error('[lead] db save failed:', e.message); log.push('db-failed'); }
  }
  console.log('[lead]', JSON.stringify({ ...lead, id: saved && saved.id, ip }));

  log.push(...(await alertOwner({ ...lead, id: saved && saved.id }).catch((e) => ['alert-failed:' + e.message])));

  if (lead.sms_consent && phone && smsReady()) {
    const body = autoTextBody(lead);
    try {
      const r = await sendSms(phone, body);
      if (saved) await addActivity(saved.id, 'sms_out', body, { auto: true, sid: r.sid });
      log.push('autotext:sent');
    } catch (e) { log.push('autotext-failed:' + e.message); if (saved) await addActivity(saved.id, 'system', 'Auto-text failed: ' + e.message).catch(() => {}); }
  }
  console.log('[lead] delivery', log.join(' | '));
  return { lead: saved || lead, id: saved ? saved.id : null, delivery: log };
}

// Website form handler: validation, honeypot, rate limit. Returns { status, json }.
async function processLead(data, ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (hits.length >= 8) return { status: 429, json: { ok: false, error: 'Too many requests. Please call us.' } };
  hits.push(now); recent.set(ip, hits);

  data = data || {};
  if (clean(data.company_website)) return { status: 200, json: { ok: true } }; // honeypot
  const email = clean(data.email);
  if (!clean(data.name) || clean(data.phone).replace(/\D/g, '').length < 10) {
    return { status: 400, json: { ok: false, error: 'Please add your name and a phone number.' } };
  }
  if ((email || data.contact_pref === 'email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 400, json: { ok: false, error: 'Please check your email address.' } };
  }
  const r = await createLead(data, { source: 'website', ip });
  const delivered = r.id || r.delivery.some((d) => /^email:|^sms:/.test(d));
  if (!delivered) return { status: 502, json: { ok: false, error: "We couldn't send that right now." } };
  return { status: 200, json: { ok: true, reference: r.id ? 'LB-' + r.id : null, texted: r.delivery.includes('autotext:sent') } };
}

function config() {
  return { license: process.env.LICENSE_NUMBER || '', uploads: uploads.ready() };
}

module.exports = { processLead, createLead, config, clean, INTENTS };
