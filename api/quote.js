// Vercel serverless function: POST /api/quote
const { processLead } = require('../lib/lead');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = Object.fromEntries(new URLSearchParams(body)); }
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const { status, json } = await processLead(body, ip);
  const wantsJson = String(req.headers.accept || '').includes('application/json');
  if (!wantsJson && json.ok) { res.statusCode = 303; res.setHeader('Location', '/thanks'); return res.end(); }
  return res.status(status).json(json);
};
