// File uploads for quote requests (plans, surveys, photos), stored in Vercel Blob.
// Browsers upload straight to Blob with a short-lived token from /api/upload, so large PDFs never pass through our functions.
// Files are private by default: only logged-in CRM users can open them, through /api/file.
const ACCESS = () => (process.env.BLOB_ACCESS === 'public' ? 'public' : 'private');
const ready = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const MAX_BYTES = 50 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'application/pdf', 'image/vnd.dwg', 'image/vnd.dxf'];
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 60 * 60_000);
  if (h.length >= 40) return true;
  h.push(now); hits.set(ip, h); return false;
}

// Only accept file links that point at our own Blob store.
function blobUrl(u) {
  try {
    const x = new URL(String(u));
    return x.protocol === 'https:' && /\.blob\.vercel-storage\.com$/.test(x.hostname) && x.pathname.startsWith('/quotes/');
  } catch { return false; }
}

function cleanFiles(list, { anyHttps = false } = {}) {
  let arr = list;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr || '[]'); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 20).map((f) => (typeof f === 'string' ? { url: f } : f || {})).filter((f) => {
    if (blobUrl(f.url)) return true;
    if (!anyHttps) return false;
    try { return new URL(String(f.url)).protocol === 'https:'; } catch { return false; }
  }).map((f) => ({
    url: String(f.url).slice(0, 600),
    name: String(f.name || decodeURIComponent(String(f.url).split('/').pop() || 'file')).slice(0, 200),
    size: Number(f.size) || null,
    type: String(f.type || '').slice(0, 100),
    stored: blobUrl(f.url),
  }));
}

module.exports = { ACCESS, ready, MAX_BYTES, TYPES, limited, blobUrl, cleanFiles };
