// POST /api/chat: the website's AI design assistant.
const { chat } = require('../lib/assistant');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  const origin = req.headers.origin;
  if (origin && req.headers.host && new URL(origin).host !== req.headers.host) return res.status(403).json({ ok: false, error: 'Bad origin' });
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { status, json } = await chat(body, ip);
    return res.status(status).json(json);
  } catch (e) {
    console.error('[chat]', e.message);
    return res.status(502).json({ ok: false, error: 'The assistant is busy right now. Call or text ' + require('../data/company.json').phone + '.' });
  }
};
