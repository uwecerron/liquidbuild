// POST /api/upload: hands the browser a short-lived token to upload one file to Vercel Blob.
const { handleUpload } = require('@vercel/blob/client');
const U = require('../lib/uploads');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!U.ready()) return res.status(503).json({ error: 'Uploads are not set up yet.' });
  const origin = req.headers.origin;
  if (origin && req.headers.host && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Bad origin' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  try {
    const json = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^quotes\/[\w.\- ()]{1,160}$/.test(pathname)) throw new Error('Invalid file name.');
        if (U.limited(ip)) throw new Error('Too many uploads. Please call or text us.');
        return { allowedContentTypes: U.TYPES, maximumSizeInBytes: U.MAX_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(json);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Upload failed.' });
  }
};
