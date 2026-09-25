// Outbound text (Twilio) and email (Resend, or FormSubmit fallback for owner alerts).
//
// Env vars:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM (+1...) or TWILIO_MESSAGING_SERVICE_SID
//   RESEND_API_KEY, RESEND_FROM ("Liquid Build <quotes@yourdomain.com>")
//   LEAD_EMAIL (owner inbox, default uwecerron@gmail.com), OWNER_PHONE (optional: text the owner on new leads)
const crypto = require('node:crypto');

const LEAD_EMAIL = () => process.env.LEAD_EMAIL || 'uwecerron@gmail.com';
const smsReady = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID));
const emailReady = () => Boolean(process.env.RESEND_API_KEY);

async function sendSms(to, body) {
  if (!smsReady()) throw Object.assign(new Error('Texting is not set up yet (add Twilio keys in Vercel settings).'), { status: 503 });
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const params = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  else params.set('From', process.env.TWILIO_FROM);
  const r = await fetch(`${process.env.TWILIO_API_BASE || 'https://api.twilio.com'}/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Text failed: ${out.message || r.status}`), { status: 502, code: out.code });
  return { sid: out.sid, status: out.status };
}

async function sendEmail({ to, subject, text, replyTo }) {
  if (!emailReady()) throw Object.assign(new Error('Email sending is not set up yet (add RESEND_API_KEY in Vercel settings).'), { status: 503 });
  const r = await fetch((process.env.RESEND_API_BASE || 'https://api.resend.com') + '/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM || 'Liquid Build <onboarding@resend.dev>', to: [].concat(to), subject, text, reply_to: replyTo || undefined }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Email failed: ${out.message || r.status}`), { status: 502 });
  return { id: out.id };
}

function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : 'https://liquidbuild.vercel.app';
}

// Owner alert for a new lead: Resend if configured, otherwise the free FormSubmit relay.
async function alertOwner(lead) {
  const subject = `New lead: ${lead.project || 'Project'}, ${lead.name}${lead.source && lead.source !== 'website' ? ' (via ' + lead.source + ')' : ''}`;
  const text = [
    `Name: ${lead.name}`, `Phone: ${lead.phone || '-'}`, `Email: ${lead.email || '-'}`, `Project: ${lead.project || '-'}`,
    `Location: ${lead.location || '-'}`, `Source: ${lead.source || 'website'}${lead.page ? ' ' + lead.page : ''}`, '', lead.details || '(no details)',
    '', lead.id ? `Open in CRM: ${siteUrl()}/crm#lead-${lead.id}` : '',
  ].join('\n');
  const results = [];
  if (emailReady()) {
    results.push(await sendEmail({ to: LEAD_EMAIL(), subject, text, replyTo: lead.email }).then(() => 'email:resend').catch((e) => 'email-failed:' + e.message));
  } else {
    const site = siteUrl();
    const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(LEAD_EMAIL())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: site + '/', Origin: site },
      body: JSON.stringify({ _subject: subject, _replyto: lead.email, _template: 'table', _captcha: 'false', name: lead.name, phone: lead.phone, email: lead.email, project: lead.project, location: lead.location, source: lead.source, details: lead.details, crm: lead.id ? `${site}/crm#lead-${lead.id}` : '' }),
    }).catch((e) => ({ ok: false, text: async () => e.message }));
    results.push(r.ok ? 'email:formsubmit' : 'email-failed:formsubmit ' + (await r.text()).slice(0, 200));
  }
  if (process.env.OWNER_PHONE && smsReady()) {
    results.push(await sendSms(process.env.OWNER_PHONE, `New lead: ${lead.name}, ${lead.project || ''} ${lead.location || ''}. ${lead.phone || lead.email || ''}`.slice(0, 300)).then(() => 'sms:owner').catch((e) => 'sms-failed:' + e.message));
  }
  return results;
}

// Twilio webhook signature check (https://www.twilio.com/docs/usage/webhooks/webhooks-security)
function validTwilioSignature(url, params, signature) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { sendSms, sendEmail, alertOwner, smsReady, emailReady, siteUrl, validTwilioSignature };
