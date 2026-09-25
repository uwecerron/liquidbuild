// Vercel function: Twilio inbound SMS webhook at /api/sms
const { handleInbound } = require('../lib/sms-inbound');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  let params = req.body || {};
  if (typeof params === 'string') params = Object.fromEntries(new URLSearchParams(params));
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const url = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}${req.url}`;
  try {
    const out = await handleInbound({ url, params, signature: req.headers['x-twilio-signature'] });
    res.statusCode = out.status; res.setHeader('Content-Type', out.type); res.end(out.body);
  } catch (e) {
    console.error('[sms]', e);
    res.statusCode = 200; res.setHeader('Content-Type', 'text/xml'); res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
};
