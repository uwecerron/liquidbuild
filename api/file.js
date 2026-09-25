// GET /api/file?u=<blob url>: streams a quote upload to a logged-in CRM user. Files are never public.
const { get } = require('@vercel/blob');
const { Readable } = require('stream');
const { currentUser } = require('../lib/auth');
const U = require('../lib/uploads');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const user = await currentUser(req).catch(() => null);
  if (!user) { res.statusCode = 302; res.setHeader('Location', '/crm'); return res.end(); }
  const u = String((req.query && req.query.u) || new URL(req.url, 'http://x').searchParams.get('u') || '');
  if (!U.blobUrl(u)) return res.status(400).send('Bad file link');
  try {
    const r = await get(u, { access: U.ACCESS() });
    if (!r) return res.status(404).send('Not found');
    res.setHeader('Content-Type', (r.blob && r.blob.contentType) || 'application/octet-stream');
    const name = decodeURIComponent(u.split('/').pop()).replace(/"/g, '');
    res.setHeader('Content-Disposition', `${String(req.query && req.query.dl) === '1' ? 'attachment' : 'inline'}; filename="${name}"`);
    const s = r.stream;
    return (typeof s.pipe === 'function' ? s : Readable.fromWeb(s)).pipe(res);
  } catch (e) {
    return res.status(502).send('Could not load file: ' + e.message);
  }
};
