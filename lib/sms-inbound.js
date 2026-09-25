// Twilio inbound text webhook. Point your Twilio number's "A message comes in" webhook to
// https://<your-site>/api/sms (HTTP POST). Replies land in the CRM thread for that lead.
const { db, hasDb, migrate, e164, addActivity } = require('./db');
const { validTwilioSignature, siteUrl, alertOwner } = require('./notify');

const STOP = /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*$/i;
const START = /^\s*(start|unstop|yes)\s*$/i;

async function handleInbound({ url, params, signature }) {
  const twiml = (msg = '') => ({ status: 200, type: 'text/xml', body: `<?xml version="1.0" encoding="UTF-8"?><Response>${msg}</Response>` });
  const publicUrl = process.env.TWILIO_WEBHOOK_URL || siteUrl() + '/api/sms';
  if (process.env.TWILIO_AUTH_TOKEN && !validTwilioSignature(publicUrl, params, signature) && !validTwilioSignature(url, params, signature)) {
    return { status: 403, type: 'text/plain', body: 'Invalid signature' };
  }
  if (!hasDb()) return twiml();
  await migrate();
  const s = db();
  const from = e164(params.From) || params.From;
  const body = String(params.Body || '').slice(0, 2000);
  let [lead] = await s`SELECT * FROM leads WHERE phone = ${from} ORDER BY last_activity_at DESC LIMIT 1`;
  if (!lead) {
    [lead] = await s`INSERT INTO leads (name, phone, project, details, source, sms_consent) VALUES (${'Text from ' + from}, ${from}, 'Other', ${body}, 'sms', true) RETURNING *`;
    await addActivity(lead.id, 'lead_created', 'New lead from an incoming text');
    alertOwner({ id: lead.id, name: lead.name, phone: from, project: 'Incoming text', details: body, source: 'sms' }).catch(() => {});
  }
  const media = Number(params.NumMedia || 0) > 0 ? Array.from({ length: Number(params.NumMedia) }, (_, i) => params['MediaUrl' + i]).filter(Boolean) : [];
  await addActivity(lead.id, 'sms_in', body, { from, sid: params.MessageSid, media });
  if (STOP.test(body)) { await s`UPDATE leads SET sms_opt_out = true WHERE id = ${lead.id}`; await addActivity(lead.id, 'system', 'Opted out of texts (STOP).'); }
  else if (START.test(body)) { await s`UPDATE leads SET sms_opt_out = false WHERE id = ${lead.id}`; }
  return twiml();
}

module.exports = { handleInbound };
