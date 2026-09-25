// Shared quote-request logic, used by the Vercel function (api/quote.js) and the local dev server (server.js).
//
// Env vars (Vercel → Project → Settings → Environment Variables):
//   LEAD_EMAIL      where quote requests go (default uwecerron@gmail.com)
//   RESEND_API_KEY  optional: send through Resend (https://resend.com) instead of FormSubmit
//   RESEND_FROM     optional: verified sender for Resend, e.g. "Liquid Build <quotes@liquidbuild.com>"
//   LICENSE_NUMBER  optional: shown in the site footer once set, e.g. "CGC000231"
//   SITE_URL        optional: the public URL, e.g. https://liquidbuild.com

const LEAD_EMAIL = process.env.LEAD_EMAIL || 'uwecerron@gmail.com';
const recent = new Map(); // best-effort rate limit per warm instance

function clean(v, max = 2000) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : 'https://liquidbuild.com';
}

async function deliver(lead) {
  const subject = `New quote request: ${lead.project} — ${lead.name}`;
  const text = [
    `Name: ${lead.name}`, `Phone: ${lead.phone}`, `Email: ${lead.email}`, `Project: ${lead.project}`,
    `Location: ${lead.location || '-'}`, `Page: ${lead.page || '-'}`, '', lead.details || '(no details)',
  ].join('\n');

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Liquid Build <onboarding@resend.dev>',
        to: [LEAD_EMAIL], reply_to: lead.email, subject, text,
      }),
    });
    if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
    return 'resend';
  }

  // FormSubmit: free relay, no account. The very first request emails LEAD_EMAIL an
  // activation link that must be clicked once; after that every lead is delivered.
  const site = siteUrl();
  const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(LEAD_EMAIL)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: site + '/', Origin: site },
    body: JSON.stringify({
      _subject: subject, _replyto: lead.email, _template: 'table', _captcha: 'false',
      name: lead.name, phone: lead.phone, email: lead.email, project: lead.project,
      location: lead.location, page: lead.page, details: lead.details,
    }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`formsubmit ${r.status}: ${body.slice(0, 300)}`);
  return 'formsubmit ' + body.slice(0, 200);
}

// Returns { status, json } — the caller writes the response.
async function processLead(data, ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (hits.length >= 8) return { status: 429, json: { ok: false, error: 'Too many requests — please call us.' } };
  hits.push(now); recent.set(ip, hits);

  data = data || {};
  if (clean(data.company_website)) return { status: 200, json: { ok: true } }; // honeypot: quietly drop bots

  const lead = {
    at: new Date().toISOString(), ip,
    name: clean(data.name, 120), phone: clean(data.phone, 40), email: clean(data.email, 200),
    project: clean(data.project, 80) || 'Other', location: clean(data.location, 200),
    details: clean(data.details, 4000), page: clean(data.page, 120),
  };
  if (!lead.name || !lead.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return { status: 400, json: { ok: false, error: 'Please add your name, phone and a valid email.' } };
  }

  console.log('[lead]', JSON.stringify(lead)); // always in the logs, even if email fails
  try {
    console.log('[lead] delivered via', await deliver(lead));
    return { status: 200, json: { ok: true } };
  } catch (e) {
    console.error('[lead] delivery failed:', e.message);
    return { status: 502, json: { ok: false, error: "We couldn't send that right now." } };
  }
}

function config() {
  return { license: process.env.LICENSE_NUMBER || '' };
}

module.exports = { processLead, config };
